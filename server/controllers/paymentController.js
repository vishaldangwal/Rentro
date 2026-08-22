// paymentController.js
import Razorpay from "razorpay";
import crypto from "crypto";
import Car from "../models/Car.js";
import Booking from "../models/Booking.js";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export const createOrder = async (req, res) => {
  try {
    const { car, pickupDate, returnDate } = req.body;

    const carData = await Car.findById(car);
    if (!carData) {
      return res.json({ success: false, message: "Car not found" });
    }

    const picked = new Date(pickupDate);
    const returned = new Date(returnDate);
    const noOfDays = Math.ceil((returned - picked) / (1000 * 60 * 60 * 24));
    if (noOfDays <= 0) {
      return res.json({ success: false, message: "Invalid dates" });
    }
    const amount = carData.pricePerDay * noOfDays;

    const order = await razorpay.orders.create({
      amount: amount * 100, // paise
      currency: "INR",
      notes: {
        car,
        pickupDate,
        returnDate,
        userId: req.user._id.toString(),
      },
    });

    res.json({ success: true, order });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.json({ success: false, message: "Missing payment details" });
    }

    // Recompute the signature ourselves — never trust the client's copy
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.json({ success: false, message: "Payment verification failed" });
    }

    // Pull the trusted booking details back from Razorpay's own order,
    // not from whatever the client sends
    const order = await razorpay.orders.fetch(razorpay_order_id);
    const { car, pickupDate, returnDate, userId } = order.notes;

    if (userId !== req.user._id.toString()) {
      return res.json({ success: false, message: "Not authorized" });
    }

    // Re-check availability at the moment of booking (see step 3 note below)
    const overlapping = await Booking.findOne({
      car,
      pickupDate: { $lte: returnDate },
      returnDate: { $gte: pickupDate },
    });
    if (overlapping) {
      return res.json({ success: false, message: "Car no longer available for these dates" });
    }

    const carData = await Car.findById(car);
    const noOfDays = Math.ceil(
      (new Date(returnDate) - new Date(pickupDate)) / (1000 * 60 * 60 * 24)
    );
    const price = carData.pricePerDay * noOfDays;

    const booking = await Booking.create({
      car,
      owner: carData.owner,
      user: req.user._id,
      pickupDate,
      returnDate,
      price,
      status: "confirmed",
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
    });

    res.json({ success: true, message: "Payment verified, booking confirmed", booking });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};
import Booking from "../models/Booking.js";
import Car from "../models/Car.js";

// Function to Check Availability of Car for a given Date
const checkAvailability = async (
  car,
  pickupDate,
  returnDate,
  session = null,
) => {
  const query = Booking.find({
    car,
    status: { $ne: "cancelled" },
    pickupDate: { $lte: returnDate },
    returnDate: { $gte: pickupDate },
  });
  if (session) query.session(session);
  const bookings = await query;
  return bookings.length === 0;
};
// API to Check Availability of Cars for the given Date and location
export const checkAvailabilityOfCar = async (req, res) => {
  try {
    const { location, pickupDate, returnDate } = req.body;

    // fetch all available cars for the given location
    const cars = await Car.find({ location, isAvaliable: true });

    // check car availability for the given date range using promise
    const availableCarsPromises = cars.map(async (car) => {
      const isAvailable = await checkAvailability(
        car._id,
        pickupDate,
        returnDate,
      );
      return { ...car._doc, isAvailable: isAvailable };
    });

    let availableCars = await Promise.all(availableCarsPromises);
    availableCars = availableCars.filter((car) => car.isAvailable === true);

    res.json({ success: true, availableCars });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

// API to Create Booking
export const createBooking = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { _id } = req.user;
    const { car, pickupDate, returnDate } = req.body;

    let bookingResult;

    await session.withTransaction(async () => {
      const isAvailable = await checkAvailability(
        car,
        pickupDate,
        returnDate,
        session,
      );
      if (!isAvailable) {
        throw new Error("Car is not available");
      }

      const carData = await Car.findById(car).session(session);
      const picked = new Date(pickupDate);
      const returned = new Date(returnDate);
      const noOfDays = Math.ceil((returned - picked) / (1000 * 60 * 60 * 24));
      const price = carData.pricePerDay * noOfDays;

      const created = await Booking.create(
        [
          {
            car,
            owner: carData.owner,
            user: _id,
            pickupDate,
            returnDate,
            price,
          },
        ],
        { session },
      );
      bookingResult = created[0];
    });

    res.json({
      success: true,
      message: "Booking Created",
      booking: bookingResult,
    });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
};

// API to List User Bookings
export const getUserBookings = async (req, res) => {
  try {
    const { _id } = req.user;
    const bookings = await Booking.find({ user: _id })
      .populate("car")
      .sort({ createdAt: -1 });
    res.json({ success: true, bookings });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

// API to get Owner Bookings

export const getOwnerBookings = async (req, res) => {
  try {
    if (req.user.role !== "owner") {
      return res.json({ success: false, message: "Unauthorized" });
    }
    const bookings = await Booking.find({ owner: req.user._id })
      .populate("car user")
      .select("-user.password")
      .sort({ createdAt: -1 });
    res.json({ success: true, bookings });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

// API to change booking status
export const changeBookingStatus = async (req, res) => {
  try {
    const { _id } = req.user;
    const { bookingId, status } = req.body;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.json({ success: false, message: "Booking not found" });
    }

    if (booking.owner.toString() !== _id.toString()) {
      return res.json({ success: false, message: "Unauthorized" });
    }

    booking.status = status;
    await booking.save();

    res.json({ success: true, message: "Status Updated" });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

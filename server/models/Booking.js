import mongoose from "mongoose";
const {ObjectId} = mongoose.Schema.Types

// models/Booking.js
const bookingSchema = new mongoose.Schema({
    car: {type: ObjectId, ref: "Car", required: true},
    user: {type: ObjectId, ref: "User", required: true},
    owner: {type: ObjectId, ref: "User", required: true},
    pickupDate: {type: Date, required: true},
    returnDate: {type: Date, required: true},
    status: {type: String, enum: ["pending", "confirmed", "cancelled"], default: "pending"},
    price: {type: Number, required: true},
    orderId: {type: String},
    paymentId: {type: String, unique: true, sparse: true},
},{timestamps: true})

const Booking = mongoose.model('Booking', bookingSchema)

export default Booking
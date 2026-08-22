import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const protect = async (req, res, next) => {
    const token = req.headers.authorization;
    if (!token) {
        return res.json({ success: false, message: "not authorized" });
    }
    try {
        const userId = jwt.verify(token, process.env.JWT_SECRET, {
            algorithms: ["HS256"],
        });

        const user = await User.findById(userId).select("-password");
        if (!user) {
            return res.json({ success: false, message: "not authorized" });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.json({ success: false, message: "not authorized" });
    }
};
import userModel from "../models/user.model.js";
import crypto from "crypto";
import config from "../config/config.js";
import jwt from "jsonwebtoken";
import sessionModel from "../models/session.model.js";
import { sendEmail } from "../services/email.service.js";
import { generateOtp,getOtpHtml } from "../utils/utils.js";
import otpModel from "../models/otp.model.js";

const isProduction = process.env.NODE_ENV === "production";

export async function register(req, res) {
    const { username, email, password } = req.body;

    const isAlreadyRegisterd = await userModel.findOne({
        $or: [
            { username },
            { email }
        ]
    });

    if (isAlreadyRegisterd) {
        return res.status(409).json({
            message: "username or email already exists"
        });
    }

    const hashedPassword = crypto
        .createHash("sha256")
        .update(password)
        .digest("hex");

    const user = await userModel.create({
        username,
        email,
        password: hashedPassword
    });

     const otp = generateOtp();
    const html = getOtpHtml(otp);

    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    await otpModel.create({
        email,
        user: user._id,
        otpHash
    })

    await sendEmail(email, "OTP Verification", `Your OTP code is ${otp}`, html)







    // const refreshToken = jwt.sign(
    //     {
    //         id: user._id
    //     },
    //     config.JWT_SECRET,
    //     {
    //         expiresIn: "7d"
    //     }
    // );

   // const refreshTokenHash=crypto.createHash("sha256").update(refreshToken).digest("hex")

    // const session=await sessionModel.create({
    //     user:user._id,
    //     refreshTokenHash,
    //     ip:req.ip,
    //     userAgent:req.headers["user-agent"]
    // })


    // const accessToken = jwt.sign(
    //     {
    //         id: user._id,
    //         sessionId:session._id
    //     },
    //     config.JWT_SECRET,
    //     {
    //         expiresIn: "15m"
    //     }
    // );

    
    // res.cookie("refreshToken", refreshToken, {
    //     httpOnly: true,
    //     secure: isProduction,
    //     sameSite: isProduction ? "strict" : "lax",
    //     path: "/",
    //     maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    // });





    res.status(201).json({
        message: "user registered successfully",
        user: {
            username: user.username,
            email: user.email,
            verified: user.verified
        },
        //accessToken
    });
}

export async function login(req, res) {
    const { email, password } = req.body;

    const user = await userModel.findOne({ email })

    if (!user) {
        return res.status(401).json({
            message: "Invalid email or password"
        })
    }

    if(!user.verified){
        return res.status(401).json({
            message: "Please verify your email before logging in"
        })
    }

    const hashedPassword = crypto.createHash("sha256").update(password).digest("hex");

    const isPasswordValid = hashedPassword === user.password;

    if (!isPasswordValid) {
        return res.status(401).json({
            message: "Invalid email or password"
        })
    }

    const refreshToken = jwt.sign({
        id: user._id
    }, config.JWT_SECRET,
        {
            expiresIn: "7d"
        }
    )

    const refreshTokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");

    const session = await sessionModel.create({
        user: user._id,
        refreshTokenHash,
        ip: req.ip,
        userAgent: req.headers[ "user-agent" ]
    })

    const accessToken = jwt.sign({
        id: user._id,
        sessionId: session._id
    }, config.JWT_SECRET,
        {
            expiresIn: "15m"
        }
    )

    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "strict" : "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    return res.status(200).json({
        message: "Logged in successfully",
        user: {
            username: user.username,
            email: user.email,
        },
        accessToken,
    })
}


export async function getMe(req, res) {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
        return res.status(401).json({
            message: "token not found"
        });
    }

    try {
        const decoded = jwt.verify(token, config.JWT_SECRET);
        const user = await userModel.findById(decoded.id);

        if (!user) {
            return res.status(401).json({
                message: "user not found"
            });
        }

        return res.status(200).json({
            message: "user fetched successfully",
            user: {
                username: user.username,
                email: user.email
            }
        });
    } catch (error) {
        return res.status(401).json({
            message: "Invalid or expired token"
        });
    }
}

export async function refreshToken(req, res) {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
        return res.status(401).json({
            message: "Refresh token not found"
        });
    }

    try {
        const decoded = jwt.verify(refreshToken, config.JWT_SECRET);

        const refreshTokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");

    const session = await sessionModel.findOne({
        refreshTokenHash,
        revoked: false
    })

    if (!session) {
        return res.status(401).json({
            message: "Invalid refresh token"
        })
    }

        const accessToken = jwt.sign(
            {
                id: decoded.id
            },
            config.JWT_SECRET,
            {
                expiresIn: "15m"
            }
        );

        const newRefreshToken=jwt.sign({
            id:decoded.id

        },config.JWT_SECRET,{
            expiresIn:"7d"
        })

         const newRefreshTokenHash = crypto.createHash("sha256").update(newRefreshToken).digest("hex");

    session.refreshTokenHash = newRefreshTokenHash;
    await session.save();


         res.cookie("refreshToken", newRefreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    })

        return res.status(200).json({
            message: "Access token refreshed successfully",
            accessToken
        });
    } catch (error) {
        return res.status(401).json({
            message: "Invalid or expired refresh token"
        });
    }
}

export async function logout(req, res) {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
        return res.status(401).json({
            message: "refresh token not found"
        });
    }

    const refreshTokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");

    const session = await sessionModel.findOne({
        refreshTokenHash,
        revoked: false
    });

    if (!session) {
        return res.status(400).json({
            message: "Invalid refresh token"
        });
    }

    session.revoked = true;
    await session.save();

    res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "strict" : "lax",
        path: "/"
    });

    return res.status(200).json({
        message: "Logged out successfully"
    });
}

export async function logoutAll(req, res) {

    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
        return res.status(400).json({
            message: "Refresh token not found"
        })
    }

    const decoded = jwt.verify(refreshToken, config.JWT_SECRET)

    await sessionModel.updateMany({
        user: decoded.id,
        revoked: false
    }, {
        revoked: true
    })

    res.clearCookie("refreshToken")

    res.status(200).json({
        message: "Logged out from all devices successfully"
    })

}

export async function verifyEmail(req, res) {
    const { otp, email } = req.body

    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

    const otpDoc = await otpModel.findOne({
        email,
        otpHash
    })

    if (!otpDoc) {
        return res.status(400).json({
            message: "Invalid OTP"
        })
    }

    const user = await userModel.findByIdAndUpdate(otpDoc.user, {
        verified: true
    })

    await otpModel.deleteMany({
        user: otpDoc.user
    })

    return res.status(200).json({
        message: "Email verified successfully",
        user: {
            username: user.username,
            email: user.email,
            verified: user.verified
        }
    })
}
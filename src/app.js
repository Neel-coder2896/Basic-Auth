import express from "express";
import morgan from "morgan"
//morgan tell us about the detail about the satust code,time etc
import authRouter from "./routes/auth.route.js";
import cookieParser from "cookie-parser";

const app=express()

app.use(express.json())
app.use(morgan("dev"))
app.use(cookieParser())
app.use("/api/auth",authRouter)

export default app;
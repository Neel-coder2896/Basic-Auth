import mongoose from "mongoose";

const userSchema=new mongoose.Schema({
    username:{
        type:String,
        required:[true,"username is required"],
        unique:[true,"username should be unique"]
    },
    email: {
        type:String,
        required:[true,"email is required"],
        unique:[true,"email should be unique"]

    },
    password:{
        type:String,
        required:[true,"password is required"],
    },
    verified:{
        type:Boolean,
        default:false
    }

})

const userModel=mongoose.model("users",userSchema)

export default userModel
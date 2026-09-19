import dns from "dns"
dns.setServers(["8.8.8.8", "1.1.1.1"]);



import app from "./src/app.js"
import connectDB from "./src/config/database.js";



connectDB()
app.listen(3000,()=>{
    console.log("server started at 3000");
    
})
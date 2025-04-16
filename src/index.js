// require('dotenv').config({path: './env'})

// import mongoose from "mongoose"
// import { DB_NAME } from "./constants";
import connectDB from "./db/index.js";
import dotenv from "dotenv";
import app from "./app.js";
// import express from 'express';
// const app = express();

dotenv.config({
  path: './env'
})

connectDB()
.then(() => {
  app.listen(process.env.PORT || 8000, () => {
    console.log(`Server is running at port : ${process.env.PORT}`);
    
  });
})
.catch((err) => {
  console.log("MONGO db connection failed !!", Error);
  //as connectDB is async so it return promise which can be handled using .then().catch()
})


/*
;( async () => {
  try{
    await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
    app.on("error", (error) => {
      console.log("ERROR: ", error);
      throw error
    })

    app.listen(process.env.PORT, () => {
      console.log(`App is Listening on port ${process.env.PORT}`);
      
    })
  }
  catch(error){
    console.error("ERROR: ", error);
    throw err 
  }
})()
*/

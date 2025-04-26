import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiErr} from "../utils/ApiError.js";
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { upload } from "../middlewares/multer.middleware.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshTokens = async(userId) => {
  try {
    const user = await User.findById(userId);
   const accessToken =  user.generateAccessToken();
   const refreshToken = user.generateRefreshToken();

   user.refreshToken = refreshToken
   await user.save({validateBeforeSave: false});

   return {accessToken, refreshToken}

  } catch (error) {
    throw new ApiErr(500, "Something went wrong while generating refresh and access token")
  }
}

const registerUser = asyncHandler( async (req, res) => {
  // get user details from fronted
  //validation - not empty
  //check if user already exists(username, email)
  //check for images, check for avatar
  //upload them to cloudinary, avatar
  //create user object - create entry in db
  //remove password and refresh toeknd field from response
  //check for user creation
  //return res

  const {username, fullName, email, password} = req.body;
  if(
    [fullName, email, username, password].some((field) => field?.trim() === "")
  ){
    throw new ApiErr(400, "All fields are requried")
  }

  const existedUser = await User.findOne({
    $or: [{username}, { email }]
  })
  if(existedUser){
    throw new ApiErr(409, "User with email or username already exists")
  }

  
  const avatarLocalPath = req.files?.avatar[0]?.path;
  // const coverImageLocalPath = req.files?.coverImage[0]?.path;

  let coverImageLocalPath;
  if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
    coverImageLocalPath = req.files.coverImage[0].path
  }

  if(!avatarLocalPath){
    throw new ApiErr(400, "Avatar file is required")
  }
  const avatar = await uploadOnCloudinary(avatarLocalPath)

  const coverImage = await uploadOnCloudinary(coverImageLocalPath)

  if(!avatar){
    throw new ApiErr(400, "Avatar file is requried")
  }

  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase()
  })

  const creaatedUser = await User.findById(user._id).select(
    "-password -refreshToken"
  )

  if(!creaatedUser){
    throw new ApiErr(500, "Something went wrong while registering the user")
  }

  return res.status(201).json(
    new ApiResponse(200, creaatedUser, "User registered Successfully")
  )
})

const loginUser = asyncHandler(async (req, res) => {
  //req body -> data 
  //username or email
  // find the user
  //password check
  //access and refresh token
  //send cookies

  const {email, username, password} = req. body;
  if(!(username || email)){
    throw new ApiErr(400, "username or email is required")
  }
  const user = await User.findOne({
    $or: [{username}, {email}]
  })

  if(!user){
    throw new ApiErr(400, "User does not exist")
  }

  const isPasswordValid = await user.isPasswordCorrect(password)

  if(!isPasswordValid){
    throw new ApiErr(401, "Invalid user Credentials")
  }

  const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)

  const loggedInUser = await User.findById(user._id).
  select("-password -refreshToken")

  const options = {
    httpOnly: true,
    secure: true
  }

  return res.status(200)
  .cookie("accessToken", accessToken, options)
  .cookie("refreshToken", refreshToken, options)
  .json(
    new ApiResponse(
      200,
      {
        user: loggedInUser, accessToken, refreshToken
      },
      "user logged in successfully"
    )
  )

})

const logoutUser = asyncHandler(async(req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined
      }
    },
    {
      new: true
    }
  )
  const options = {
    httpOnly: true,
    secure: true
  }

  return res.status(200)
  .clearCookie("accessToken", options)
  .clearCookie("refreshToken", options)
  .json(new ApiResponse(200, {}, "User logged Out"));
})

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

  if(!incomingRefreshToken){
    throw new ApiErr(401, "Unauthorized Request")
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    )
  
    const user = await User.findById(decodedToken?._id)
  
    if(!user){
      throw new ApiErr(401, "Invalid refresh token")
    }
  
    if(incomingRefreshToken !== user?.refreshToken){
      throw new ApiErr(401, "Refresh token is expired or used")
    }
  
    const options = {
      httpOnly: true,
      secure: true
    }
    const {accessToken, newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
  
    return res.status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", newRefreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          accessToken,
          newRefreshToken
        },
        "Access Token refreshed"
      )
    )
  } catch (error) {
    throw new ApiErr(401, error?.message || "Invalid refresh token") 
  }
})

const changeCurrentPassword = asyncHandler(async(req, res) => {
  const {oldPassword, newPassword} = req.body
  const user = await User.findById(req.user?._id)
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

  if(isPasswordCorrect){
    throw new ApiErr(400, "Invalid old password")
  }

  user.password = newPassword
  await user.save({validateBeforeSave: false})

  return res
  .status(200)
  .json(new ApiResponse(200, {}, "Password Changed SuccessFully"))
})

const getCurrentUser = asyncHandler(async(req, res) => {
  return res
  .status(200)
  .json(new ApiResponse(200, req.user, "Cureent user Fetched successfully"))
})

const updateAccountDetails = asyncHandler(async(req, res) => {
  const {fullName, email} = req.body
  if(!fullName && !email){
    throw new ApiErr(400, "All field requried")
  }

  const user = User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName,
        email: email
      }
    },
    {new : true}
  ).select("-Password")

  return res
  .status(200)
  .json(new ApiResponse(200, user, "Account details updated"))
})

const updateUserAvatar = asyncHandler(async(req, res) => {
  const avatarLocalPath = req.file?.path
  if(!avatarLocalPath){
    throw new ApiErr(400, "Avatar file is missing")
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath)

  if(!avatar.url){
    throw new ApiErr(400, "Error while uploading on avatar")
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set:{
        avatar: avatar.url
      }
    },
    {new: true}
  ).select("-password")

  return res
  .status(200)
  .json(
    new ApiResponse(200, user, "Avatar updated successfully")
  )
})

const updateUserCoverImage = asyncHandler(async(req, res) => {
  const coverImageLocalPath = req.file?.path
  if(!coverImageLocalPath){
    throw new ApiErr(400, "CoverImage is missing")
  }

  const coverrImage = await uploadOnCloudinary(coverImageLocalPath)

  if(!coverrImage.url){
    throw new ApiErr(400, "Error while uploading on Image")
  }

  await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set:{
        coverImage: coverImage.url
      }
    },
    {new: true}
  ).select("-password")

  return res
  .status(200)
  .json(
    new ApiResponse(200, user, "Cover Image updated")
  )
})

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage
}
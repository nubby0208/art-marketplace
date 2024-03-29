import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'

import User from '../models/user.model'
import { InfoJWT } from '../types'

import {
  generateAccessToken,
  generateRefreshToken,
  getUrlFromKey
} from '../utils'
const circleUtils = require('../utils/circleUtils')

export const lookupEmail = async (req: any, res: any) => {
  try {
    let user = await User.findOne({ username: req.body.userName })
    if (user) {
      res.status(200).json({
        email: user.usernameOrEmail
      })
    } else {
      res.status(400).json({
        type: 'Lookup failed',
        success: false,
        message: 'No Matching email found'
      })
    }
  } catch (error) {
    console.log(error)
    return res.status(500).json({ error: error })
  }
}

export const refreshToken = async (req: any, res: any) => {
  const { _id, role } = req.user
  const userInfo: InfoJWT = { _id, role }

  const accessToken = generateAccessToken(userInfo)
  const refreshToken = generateRefreshToken(userInfo)

  res.status(200).json({ accessToken, refreshToken })
}

export const loginUserFirebase = async (req: any, res: any) => {
  try {
    let user = await User.findOne({ usernameOrEmail: req.body.email })
    if (user) {
      const userInfo: InfoJWT = { _id: user._id, role: user.role }
      const token = generateAccessToken(userInfo)
      const refreshToken = generateRefreshToken(userInfo)

      let avatartUrl: any = null
      let bannerUrl: any = null

      if (user.avatar) {
        avatartUrl = await getUrlFromKey(user.avatar)
      }

      if (user.banner) {
        bannerUrl = await getUrlFromKey(user.banner)
      }

      if (token) {
        res.status(200).json({
          success: true,
          token: token,
          refreshToken: refreshToken,
          user: {
            id: user.id,
            name: user.firstName + ' ' + user.lastName,
            usernameOrEmail: user.usernameOrEmail,
            role: user.role,
            avatar: avatartUrl,
            banner: bannerUrl,
            username: user.username,
            bio: user.bio
          }
        })
      } else {
        res.status(400).json({
          type: 'Authentication Failed',
          success: false,
          message: 'Incorrect login credentials, please try again.'
        })
      }
    } else {
      res.status(400).json({
        type: 'Authentication Failed',
        success: false,
        message: 'Incorrect login credentials, please try again.'
      })
    }
  } catch (error) {
    console.log(error)
    return res.status(500).json({ error: error })
  }
}

export const createUserFirebase = async (req: any, res: any) => {
  try {
    let user = await User.findOne({ usernameOrEmail: req.body.email })
    const response = await circleUtils.createCircleWallet()
    if (user) {
      user.username = req.body.username
      await user.save()
    } else {
      user = new User({
        username: req.body.username,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        usernameOrEmail: req.body.email,
        role: req.body.role ? req.body.role : 0,
        circleWalletId: response.data.walletId
      })
      await user.save()
    }

    let avatartUrl: any = null

    if (user.avatar) {
      avatartUrl = await getUrlFromKey(user.avatar)
    }

    const userInfo: InfoJWT = { _id: user._id, role: user.role }
    const token = generateAccessToken(userInfo)
    const refreshToken = generateRefreshToken(userInfo)

    if (token) {
      res.status(200).json({
        success: true,
        token: token,
        refreshToken: refreshToken,
        user: {
          id: user.id,
          name: user.firstName + ' ' + user.lastName,
          usernameOrEmail: user.usernameOrEmail,
          role: user.role,
          avatar: avatartUrl,
          username: user.username
        }
      })
    } else {
      res.status(400).json({
        type: 'Authentication Failed',
        success: false,
        message: 'Incorrect login credentials, please try again.'
      })
    }
  } catch (error) {
    console.log(error)
    return res.status(500).json({ error: error })
  }
}

export const loginWithJwt = async (req: any, res: any) => {
  try {
    let decoded = jwt.decode(req.body.idToken) as any
    let user = await User.findOne({ usernameOrEmail: decoded?.email })
    console.log(decoded)
    if (!user) {
      const response = await circleUtils.createCircleWallet()
      //create user
      user = new User({
        name: decoded?.name,
        username: decoded?.email,
        usernameOrEmail: decoded?.email,
        role: 0,
        avatar: decoded?.picture,
        googleId: decoded?.user_id,
        circleWalletId: response?.data?.walletId
      })
      await user.save()
    }

    let avatartUrl: any = null
    let bannerUrl: any = null

    if (user.avatar) {
      avatartUrl = await getUrlFromKey(user.avatar)
    }
    if (user.banner) {
      bannerUrl = await getUrlFromKey(user.banner)
    }

    const userInfo: InfoJWT = { _id: user._id, role: user.role }
    const token = generateAccessToken(userInfo)
    const refreshToken = generateRefreshToken(userInfo)

    if (token) {
      res.status(200).json({
        success: true,
        token: token,
        refreshToken: refreshToken,
        user: {
          id: user.id,
          name: user.name,
          usernameOrEmail: user.usernameOrEmail,
          role: user.role,
          avatar: avatartUrl,
          username: user.username,
          banner: bannerUrl,
          bio: user.bio,
          walletAddresses: user.walletAddresses,
          linkedWalletAddresses: user.linkedWalletAddresses
        }
      })
    } else {
      res.status(400).json({
        type: 'Authentication Failed',
        success: false,
        message: 'Incorrect login credentials, please try again.'
      })
    }
  } catch (error) {
    console.log(error)
    return res.status(500).json({ error: error })
  }
}

//Authenticate User
export const login = async (req: any, res: any) => {
  const login = {
    username: req.body.userName,
    password: req.body.password
  }

  try {
    let user
    if (login.username.includes('@')) {
      user = await User.findOne({
        email: login.username
      })
    } else {
      user = await User.findOne({
        userName: login.username
      })
    }

    if (!user) {
      console.log(`Failed authentication for user ${login.username}`)

      res.status(400).json({
        type: 'Authentication Failed',
        message: 'Incorrect login credentials, please try again.'
      })

      return
    }

    let match = await bcrypt.compare(login.password, user.password)
    if (match) {
      const userInfo: InfoJWT = { _id: user._id, role: user.role }
      const token = generateAccessToken(userInfo)
      const refreshToken = generateRefreshToken(userInfo)

      let avatartUrl: any = null
      let bannerUrl: any = null

      if (user.avatar) {
        avatartUrl = await getUrlFromKey(user.avatar)
      }

      if (user.banner) {
        bannerUrl = await getUrlFromKey(user.banner)
      }

      if (token) {
        res.status(200).json({
          success: true,
          token: token,
          refreshToken: refreshToken,
          user: {
            id: user.id,
            name: user.firstName + ' ' + user.lastName,
            usernameOrEmail: user.usernameOrEmail,
            role: user.role,
            avatar: avatartUrl,
            banner: bannerUrl
          }
        })
      } else {
        res.status(400).json({
          type: 'Authentication Failed',
          success: false,
          message: 'Incorrect login credentials, please try again.'
        })
      }
    }
  } catch (err) {
    console.log(err)
    res.status(500).json({
      type: 'Authentication error',
      message: err
    })
  }
}

export const verify = async (req: any, res: any) => {
  res.status(200).json({
    success: true,
    message: 'Verified'
  })
}

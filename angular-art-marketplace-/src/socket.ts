import { Server } from 'socket.io'
import { createClient } from 'redis'
import { createAdapter } from '@socket.io/redis-adapter'

import { authenticateTokenSocket } from './middlewares'
import { AuctionExpireResponse } from './models/auction'
import { AuctionBidResponse } from './models/auctionBid'

export interface ServerToClientEvents {
  newBid: (bid: AuctionBidResponse) => void
  expireAuction: (expired: AuctionExpireResponse) => void
}

const io = new Server<ServerToClientEvents>()

io.use(authenticateTokenSocket)

io.on('connection', (socket) => {
  const { auctionId } = socket.handshake.query
  // TODO:
  // if there's an onGoing Auction, then join that room
  // else don't connect
  if (auctionId) socket.join(auctionId)
})

export const broadcastNewBid = (auctionId: string, bid: AuctionBidResponse) => {
  io.to(auctionId).emit('newBid', bid)
}

export default async () => {
  const pubClient = createClient({ url: process.env.REDIS_URL })
  const subClient = pubClient.duplicate()

  await pubClient.connect()
  await subClient.connect()

  console.log('Connected to Redis')

  io.adapter(createAdapter(pubClient, subClient))

  return { io, pubClient, subClient }
}

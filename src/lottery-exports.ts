// Here we export some useful types and functions for interacting with the Anchor program.
import { AnchorProvider, Program } from '@coral-xyz/anchor'
import { Cluster, PublicKey } from '@solana/web3.js'
import LotteryIDL from '../target/idl/lottery.json'
import type { Lottery } from '../target/types/lottery'

// Re-export the generated IDL and type
export { Lottery, LotteryIDL }

// The programId is imported from the program IDL.
export const LOTTERY_PROGRAM_ID = new PublicKey(LotteryIDL.address)

// This is a helper function to get the Lottery Anchor program.
export function getLotteryProgram(provider: AnchorProvider, address?: PublicKey) {
  return new Program({ ...LotteryIDL, address: address ? address.toBase58() : LotteryIDL.address } as Lottery, provider)
}

// This is a helper function to get the program ID for the Lottery program depending on the cluster.
export function getLotteryProgramId(cluster: Cluster) {
  switch (cluster) {
    case 'devnet':
    case 'testnet':
      // This is the program ID for the Lottery program on devnet and testnet.
      return new PublicKey('coUnmi3oBUtwtd9fjeAvSsJssXh5A5xyPbhpewyzRVF')
    case 'mainnet-beta':
    default:
      return LOTTERY_PROGRAM_ID
  }
}

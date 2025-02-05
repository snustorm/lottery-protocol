import * as anchor from '@coral-xyz/anchor'
import {Program} from '@coral-xyz/anchor'
import {Keypair, sendAndConfirmTransaction, Transaction} from '@solana/web3.js'
import {Lottery} from '../target/types/lottery'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'

describe('lottery', () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)
  const wallet = provider.wallet as anchor.Wallet
  const program = anchor.workspace.Lottery as Program<Lottery>

  const metadata_program_id = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";

  const lotteryKeypair = Keypair.generate()

  it('Initialize Config', async () => {
    const initConfigIx = await program.methods
      .initializeConfig(
        new anchor.BN(0),
        new anchor.BN(1748573344),
        new anchor.BN(10000)
      ).instruction();

      const blockhashWithContext = await provider.connection.getLatestBlockhash();

      const tx = new Transaction({
        feePayer: provider.wallet.publicKey,
        blockhash: blockhashWithContext.blockhash,
        lastValidBlockHeight: blockhashWithContext.lastValidBlockHeight,
      }).add(initConfigIx);
      
      const signature = await sendAndConfirmTransaction(provider.connection, tx, [wallet.payer] );
      console.log("Your transactions signature", signature);

      const initLotteryIx = await program.methods.
        initializeLottery()
            .accounts({
                tokenProgram: TOKEN_PROGRAM_ID
            }).
            instruction();

      const initLotteryTx = new anchor.web3.Transaction(
        {
            feePayer: provider.wallet.publicKey,
            blockhash: blockhashWithContext.blockhash,
            lastValidBlockHeight: blockhashWithContext.lastValidBlockHeight,
        }
      ).add(initLotteryIx);

      const initLotterySign = await sendAndConfirmTransaction(provider.connection, initLotteryTx, [wallet.payer]);
      console.log("Your transaction signature", initLotterySign);

      


  })



  
})

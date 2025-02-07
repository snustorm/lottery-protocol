import * as anchor from '@coral-xyz/anchor'
import {Program} from '@coral-xyz/anchor'
import {Keypair, PublicKey, sendAndConfirmTransaction, Transaction} from '@solana/web3.js'
import {Lottery} from '../target/types/lottery'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import * as sb from '@switchboard-xyz/on-demand'
import SwitchboardIDL from '../switchborad.json'


describe('lottery', () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)
  const wallet = provider.wallet as anchor.Wallet
  const program = anchor.workspace.Lottery as Program<Lottery>

  const switchboardProgram = new anchor.Program(
    SwitchboardIDL as anchor.Idl,
    provider
    );


  const rngKp = anchor.web3.Keypair.generate();

//   beforeAll( async () => {
//     const switchboardIDL = await anchor.Program.fetchIdl(
//       sb.ON_DEMAND_MAINNET_PID,
//       {connection: new anchor.web3.Connection("https://api.mainnet-beta.solana.com")}
//     ) as anchor.Idl;

//     switchboardProgram = new anchor.Program(switchboardIDL, provider);
//   });


  const metadata_program_id = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";

  const lotteryKeypair = Keypair.generate()


  async function buyTicket() {

    const buyTicketIx = await program.methods.buyTicket()
        .accounts({
            tokenProgram: TOKEN_PROGRAM_ID
        })
        .instruction();

    const computeIx = anchor.web3.ComputeBudgetProgram.setComputeUnitLimit(
        {
            units: 300000
        }
    );

    const priorityIx = anchor.web3.ComputeBudgetProgram.setComputeUnitPrice(
        {
            microLamports: 1
        }
    );

    const blockhashWithContext = await provider.connection.getLatestBlockhash();
    const tx = new anchor.web3.Transaction(
        {
            feePayer: provider.wallet.publicKey,
            blockhash: blockhashWithContext.blockhash,
            lastValidBlockHeight: blockhashWithContext.lastValidBlockHeight,
        }
    ).add(buyTicketIx)
    .add(computeIx)
    .add(priorityIx);

    const signature = await sendAndConfirmTransaction(
        provider.connection,
        tx,
        [wallet.payer],
        { skipPreflight: true}
    )

    console.log("Buy ticket transaction signature", signature);

  }

  it('Initialize Config', async () => {


    const slot = await provider.connection.getSlot();
    const endSlot = slot + 20;

    const initConfigIx = await program.methods
      .initializeConfig(
        new anchor.BN(slot),
        new anchor.BN(endSlot),
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

    await buyTicket();
    await buyTicket();
    await buyTicket();
    await buyTicket();
    await buyTicket();
    await buyTicket();

    const queue =  await new PublicKey("A43DyUGA7s8eXPxqEjJY6EBu1KKbNgfxF8h17VAHn13w");

    const queueAccount = new sb.Queue(switchboardProgram, queue);

    try {
        await queueAccount.loadData();
    } catch (error) {
        console.log("Error", error);
        process.exit(1);    
    }

    const [randomness, createRandomnessIx] = await sb.Randomness.create(switchboardProgram, rngKp, queue);
    
    const createRandomnessTx = await sb.asV0Tx({
        connection: provider.connection,
        ixs: [createRandomnessIx],
        payer: wallet.publicKey,
        signers: [wallet.payer, rngKp],
        computeUnitPrice: 75_000,
        computeUnitLimitMultiple: 1.3,
    })

    const createRandomnessSign = await provider.connection.sendTransaction(
        createRandomnessTx
    );

    const blockhashContext = await provider.connection.getLatestBlockhashAndContext();

    await provider.connection.confirmTransaction({
        signature: createRandomnessSign,
        blockhash: blockhashContext.value.blockhash,
        lastValidBlockHeight: blockhashContext.value.lastValidBlockHeight
      });
      console.log(
        "Transaction Signature for randomness account creation: ",
        createRandomnessSign
      );

    const sbCommitIx = await randomness.commitIx(queue);

    const commitIx = await program.methods.commitRandomness().
            accounts({randomnessAccount: randomness.pubkey})
            .instruction();


    const commitBlockhashWithContext = await provider.connection.getLatestBlockhash();  

    const commitTx = await sb.asV0Tx({
        connection: switchboardProgram.provider.connection,
        ixs: [sbCommitIx, commitIx],
        payer: wallet.publicKey,
        signers: [wallet.payer],
        computeUnitPrice: 75_000,
        computeUnitLimitMultiple: 1.3,
      });

      const commitSignature = await provider.connection.sendTransaction(commitTx);

      await provider.connection.confirmTransaction({
        signature: commitSignature,
        blockhash: blockhashContext.value.blockhash,
        lastValidBlockHeight: blockhashContext.value.lastValidBlockHeight
      });
      console.log(
        "Transaction Signature for commit: ",
        commitSignature
      );


      const sbRevealIx = await randomness.revealIx();
      const revealWinnerIx = await program.methods.revealWinner()
      .accounts({
        randomnessAccount: randomness.pubkey
      }).instruction();

      const revealBlockhashWithContext = await provider.connection.getLatestBlockhash();    

      const revealTx = new Transaction({    
        feePayer: provider.wallet.publicKey,
        blockhash: revealBlockhashWithContext.blockhash,
        lastValidBlockHeight: revealBlockhashWithContext.lastValidBlockHeight,
      })
      .add(sbRevealIx)
      .add(revealWinnerIx);

      let currenctSlot = 0;

      while( currenctSlot < endSlot) {
        const slot = await provider.connection.getSlot();
        if (slot > currenctSlot) {
            currenctSlot = slot;
            console.log("Current slot", slot);
        }
      }

      const revealSignature = await sendAndConfirmTransaction(provider.connection, revealTx, [wallet.payer]);

      console.log('revealSignature', revealSignature);

      const claimIx = await program.methods.claimWinnings()
        .accounts({
            tokenProgram: TOKEN_PROGRAM_ID
        }).instruction();

        const claimBlockhashWithContext = await provider.connection.getLatestBlockhash();
        const claimTx = new anchor.web3.Transaction( {
            feePayer: provider.wallet.publicKey,
            blockhash: claimBlockhashWithContext.blockhash,
            lastValidBlockHeight: claimBlockhashWithContext.lastValidBlockHeight,
        }).add(claimIx);

        const claimSignature = await anchor.web3.sendAndConfirmTransaction(
            provider.connection, claimTx, [wallet.payer]
        );

        console.log('claim Signature', claimSignature);


}, 30000)



  
})

# Ordo

Batch USDC payment operations for Arc Network.

## The Problem

Distributing USDC to multiple recipients on any chain 
means sending transactions one by one, manually 
calculating totals, and having no visibility into what 
the operation actually costs before it runs. On chains 
where gas is a separate volatile token, the overhead 
compounds further.

Arc changes the cost model. USDC is the native gas 
token, which means the total cost of a batch operation 
is denominated in the same asset being distributed. 
Ordo is built specifically for this.

## How It Works

1. Upload a CSV with recipient addresses, amounts, 
   and optional notes
2. Ordo validates every row and flags errors before 
   anything moves
3. Preview the full cost breakdown: total distribution, 
   estimated gas in USDC, and a comparison against 
   what the same batch would cost on other chains
4. Execute the batch in one operation via Multicall3
5. Get per-recipient status and export results for 
   your records

## Who It's For

Project founders and ops teams distributing bounties, 
rewards, grants, or contributor payouts on Arc.

## Tech Stack

- Next.js 14 (App Router)
- wagmi v2 + viem
- RainbowKit
- Supabase (batch history)
- Arc Network (Chain ID: 5042002)
- Vercel (deployment)

## Status

Active development. Building on Arc testnet.

## Roadmap

- [x] Repo initialized
- [ ] CSV upload with live validation
- [ ] Cost preview and chain comparison
- [ ] Batch execute via Multicall3
- [ ] Per-recipient status tracking
- [ ] Batch history dashboard
- [ ] Export results as CSV
- [ ] Mainnet deployment
- [ ] 

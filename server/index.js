require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const NodeCache = require('node-cache');
const { publicEncrypt } = require('crypto');
const { Connection, PublicKey } = require('@solana/web3.js');

const app = express();
const cache = new NodeCache({ stdTTL: 60 }); // Cache for 60 seconds

// Middleware
app.use(cors());
app.use(express.json());

const SOLANA_RPC = process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com';
const JUPITER_API = 'https://quote-api.jup.ag/v6';

// Initialize Solana connection
const connection = new Connection(SOLANA_RPC);

// Route to get token list
app.get('/api/tokens', async (req, res) => {
    try {
        const cachedTokens = cache.get('tokens');
        if (cachedTokens) {
            return res.json(cachedTokens);
        }

        const response = await axios.get(`${JUPITER_API}/tokens`);
        const tokens = response.data;
        cache.set('tokens', tokens);
        res.json(tokens);
    } catch (error) {
        console.error('Error fetching tokens:', error);
        res.status(500).json({ error: 'Failed to fetch tokens' });
    }
});

// Route to get quote
app.post('/api/quote', async (req, res) => {
    try {
        const { inputMint, outputMint, amount, slippage } = req.body;
        
        const cacheKey = `quote-${inputMint}-${outputMint}-${amount}`;
        const cachedQuote = cache.get(cacheKey);
        if (cachedQuote) {
            return res.json(cachedQuote);
        }

        const response = await axios.get(`${JUPITER_API}/quote`, {
            params: {
                inputMint,
                outputMint,
                amount: amount.toString(),
                slippageBps: Math.round(slippage * 100)
            }
        });

        const quote = response.data;
        cache.set(cacheKey, quote);
        res.json(quote);
    } catch (error) {
        console.error('Error fetching quote:', error);
        res.status(500).json({ error: 'Failed to fetch quote' });
    }
});

// Route to get swap transaction
app.post('/api/swap', async (req, res) => {
    try {
        const { quoteResponse, userPublicKey } = req.body;
        
        const response = await axios.post(`${JUPITER_API}/swap`, {
            quoteResponse,
            userPublicKey,
            wrapAndUnwrapSol: true,
        });

        res.json(response.data);
    } catch (error) {
        console.error('Error creating swap transaction:', error);
        res.status(500).json({ error: 'Failed to create swap transaction' });
    }
});

// Route to get transaction history for a wallet
app.get('/api/transactions/:wallet', async (req, res) => {
    try {
        const { wallet } = req.params;
        const publicKey = new PublicKey(wallet);
        
        const transactions = await connection.getConfirmedSignaturesForAddress2(
            publicKey,
            { limit: 20 }
        );
        
        res.json(transactions);
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
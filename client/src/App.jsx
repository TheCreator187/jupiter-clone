import React, { useState, useEffect } from 'react';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { WalletProvider, useWallet } from '@solana/wallet-adapter-react';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { JupiterProvider, useJupiter } from '@jup-ag/react-hook';
import axios from 'axios';

require('@solana/wallet-adapter-react-ui/styles.css');

const SwapForm = () => {
  const { publicKey, signTransaction } = useWallet();
  const [tokens, setTokens] = useState([]);
  const [inputToken, setInputToken] = useState(null);
  const [outputToken, setOutputToken] = useState(null);
  const [inputAmount, setInputAmount] = useState('');
  const [slippage, setSlippage] = useState(0.5);
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [txHistory, setTxHistory] = useState([]);

  useEffect(() => {
    const fetchTokens = async () => {
      try {
        const response = await axios.get('/api/tokens');
        setTokens(response.data);
        // Default to SOL and USDC
        const solToken = response.data.find(token => token.symbol === 'SOL');
        const usdcToken = response.data.find(token => token.symbol === 'USDC');
        if (solToken) setInputToken(solToken);
        if (usdcToken) setOutputToken(usdcToken);
      } catch (err) {
        console.error('Error fetching tokens:', err);
      }
    };
    fetchTokens();
  }, []);

  useEffect(() => {
    if (publicKey) {
      fetchTransactionHistory();
    }
  }, [publicKey]);

  const fetchTransactionHistory = async () => {
    try {
      const response = await axios.get(`/api/transactions/${publicKey.toString()}`);
      setTxHistory(response.data);
    } catch (err) {
      console.error('Error fetching transaction history:', err);
    }
  };

  const fetchQuote = async () => {
    if (!inputToken || !outputToken || !inputAmount) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.post('/api/quote', {
        inputMint: inputToken.address,
        outputMint: outputToken.address,
        amount: parseFloat(inputAmount) * Math.pow(10, inputToken.decimals),
        slippage
      });
      
      setQuote(response.data);
    } catch (err) {
      console.error('Error fetching quote:', err);
      setError('Failed to get quote. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const executeSwap = async () => {
    if (!quote || !publicKey || !signTransaction) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Get swap transaction
      const swapResponse = await axios.post('/api/swap', {
        quoteResponse: quote,
        userPublicKey: publicKey.toString()
      });
      
      const swapTransactionBuf = Buffer.from(swapResponse.data.swapTransaction, 'base64');
      const transaction = Transaction.from(swapTransactionBuf);
      
      // Sign and send transaction
      const signedTransaction = await signTransaction(transaction);
      const rawTransaction = signedTransaction.serialize();
      
      const connection = new Connection('https://api.mainnet-beta.solana.com');
      const txid = await connection.sendRawTransaction(rawTransaction);
      
      console.log('Transaction sent:', txid);
      alert(`Swap successful! Transaction ID: ${txid}`);
      
      // Refresh quote and history
      fetchQuote();
      fetchTransactionHistory();
    } catch (err) {
      console.error('Error executing swap:', err);
      setError('Failed to execute swap. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-gray-900 rounded-xl shadow-md overflow-hidden md:max-w-2xl p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Jupiter Clone</h1>
        <WalletMultiButton className="bg-purple-600 hover:bg-purple-700" />
      </div>
      
      <div className="space-y-4">
        {/* Input Token */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex justify-between mb-2">
            <label className="text-gray-300">From</label>
            <span className="text-gray-400">Balance: {publicKey ? 'Fetching...' : 'Connect wallet'}</span>
          </div>
          <div className="flex">
            <input
              type="number"
              value={inputAmount}
              onChange={(e) => setInputAmount(e.target.value)}
              placeholder="0.0"
              className="flex-1 bg-gray-700 text-white p-2 rounded-l-lg focus:outline-none"
            />
            <select
              value={inputToken?.address}
              onChange={(e) => {
                const token = tokens.find(t => t.address === e.target.value);
                setInputToken(token);
              }}
              className="bg-gray-700 text-white p-2 rounded-r-lg focus:outline-none"
            >
              {tokens.map(token => (
                <option key={token.address} value={token.address}>
                  {token.symbol}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        {/* Output Token */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex justify-between mb-2">
            <label className="text-gray-300">To</label>
            <span className="text-gray-400">Balance: {publicKey ? 'Fetching...' : 'Connect wallet'}</span>
          </div>
          <div className="flex">
            <input
              type="text"
              value={quote ? (quote.outAmount / Math.pow(10, outputToken?.decimals || 1)).toFixed(6) : '0.0'}
              readOnly
              className="flex-1 bg-gray-700 text-white p-2 rounded-l-lg focus:outline-none"
            />
            <select
              value={outputToken?.address}
              onChange={(e) => {
                const token = tokens.find(t => t.address === e.target.value);
                setOutputToken(token);
              }}
              className="bg-gray-700 text-white p-2 rounded-r-lg focus:outline-none"
            >
              {tokens.map(token => (
                <option key={token.address} value={token.address}>
                  {token.symbol}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        {/* Slippage */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <label className="text-gray-300 block mb-2">Slippage Tolerance (%)</label>
          <div className="flex space-x-2">
            {[0.1, 0.5, 1.0].map(value => (
              <button
                key={value}
                onClick={() => setSlippage(value)}
                className={`px-3 py-1 rounded ${slippage === value ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300'}`}
              >
                {value}%
              </button>
            ))}
            <input
              type="number"
              value={slippage}
              onChange={(e) => setSlippage(parseFloat(e.target.value))}
              step="0.1"
              min="0.1"
              max="50"
              className="flex-1 bg-gray-700 text-white p-1 px-2 rounded focus:outline-none"
            />
          </div>
        </div>
        
        {/* Quote Info */}
        {quote && (
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="grid grid-cols-2 gap-2 text-sm text-gray-300">
              <div>Price Impact:</div>
              <div className="text-right">{quote.priceImpactPct}%</div>
              
              <div>Minimum Received:</div>
              <div className="text-right">
                {(quote.otherAmountThreshold / Math.pow(10, outputToken?.decimals || 1)).toFixed(6)} {outputToken?.symbol}
              </div>
              
              <div>Route:</div>
              <div className="text-right">
                {quote.routePlan.map((step, i) => (
                  <span key={i}>
                    {step.swapInfo.label}{i < quote.routePlan.length - 1 ? ' → ' : ''}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* Action Buttons */}
        <div className="space-y-2">
          <button
            onClick={fetchQuote}
            disabled={!inputToken || !outputToken || !inputAmount || loading}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 px-4 rounded-lg disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Get Quote'}
          </button>
          
          <button
            onClick={executeSwap}
            disabled={!quote || !publicKey || loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Swap'}
          </button>
        </div>
        
        {error && (
          <div className="text-red-500 text-sm p-2 bg-red-900 rounded">
            {error}
          </div>
        )}
      </div>
      
      {/* Transaction History */}
      {publicKey && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold text-white mb-4">Recent Transactions</h2>
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            {txHistory.length > 0 ? (
              <ul className="divide-y divide-gray-700">
                {txHistory.map(tx => (
                  <li key={tx.signature} className="p-3 hover:bg-gray-700">
                    <a 
                      href={`https://solscan.io/tx/${tx.signature}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex justify-between text-sm"
                    >
                      <span className="text-gray-300 truncate">{tx.signature}</span>
                      <span className="text-gray-400">{new Date(tx.blockTime * 1000).toLocaleString()}</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-4 text-center text-gray-400">No transactions found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const App = () => {
  const network = WalletAdapterNetwork.Mainnet;
  const wallets = [new PhantomWalletAdapter()];

  return (
    <WalletProvider wallets={wallets} autoConnect>
      <WalletModalProvider>
        <JupiterProvider connection={new Connection('https://api.mainnet-beta.solana.com')}>
          <div className="min-h-screen bg-gray-950 py-10 px-4">
            <SwapForm />
          </div>
        </JupiterProvider>
      </WalletModalProvider>
    </WalletProvider>
  );
};

export default App;
module.exports = {
  networks: {
      development: {
        host: "localhost",
        port: 8545,
        network_id: "*" // Match any network id
      }
  }
};

/*
ROPSTEN
0x067faED55b5465310444db9641D3Bba122a16422
geth --datadir "D:/Tools/Ethereum/testnet/chaindata" --fast --cache=1048 --testnet --ws --wsport 8546 --wsorigins "*" --rpc --rpcapi "eth,net,web3" --rpccorsdomain '*'
geth --datadir "D:/Tools/Ethereum/testnet/chaindata" import account "D:/ropsten.txt"
*/

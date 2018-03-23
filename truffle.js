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
geth --datadir "D:/Tools/Ethereum/testnet/chaindata" --fast --cache=2048 --testnet --ws --wsport 8546 --wsorigins "*" --rpc --rpcapi "eth,net,web3" --rpccorsdomain '*'
geth --datadir "D:/Tools/Ethereum/testnet/chaindata" --testnet --ws --wsport 8546 --wsorigins "*" --rpc --rpcapi "eth,net,web3" --rpccorsdomain '*'
geth --datadir "D:/Tools/Ethereum/mainnet/chaindata" --fast --cache=2048 --ws --wsport 8546 --wsorigins "*" --rpc --rpcapi "eth,net,web3" --rpccorsdomain '*'
geth --datadir "D:/Tools/Ethereum/mainnet/chaindata" --fast --cache=6144 --ws --wsport 8546 --wsorigins "*" --rpc --rpcapi "eth,net,web3" --rpccorsdomain '*'
geth --datadir "E:/Ethereum/mainnet/chaindata" --fast --cache=6144 --ws --wsport 8546 --wsorigins "*" --rpc --rpcapi "eth,net,web3" --rpccorsdomain '*'

geth --datadir "E:/Ethereum/mainnet/chaindata" --syncmode "light" --cache=6144 --ws --wsport 8546 --wsorigins "*" --rpc --rpcapi "eth,net,web3" --rpccorsdomain '*'
geth --datadir "E:/Ethereum/mainnet/chaindata" account import "D:/ropsten.txt"

geth --datadir "E:/Ethereum/testnet/chaindata" --testnet --syncmode "light" --cache=6144 --ws --wsport 8546 --wsorigins "*" --rpc --rpcapi "eth,net,web3" --rpccorsdomain '*'
geth --datadir "E:/Ethereum/testnet/chaindata" account import "D:/ropsten.txt"
*/

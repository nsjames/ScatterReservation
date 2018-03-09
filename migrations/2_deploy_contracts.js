var ScatterReservation = artifacts.require('./ScatterReservation.sol');

module.exports = function(deployer){
  deployer.deploy(ScatterReservation, "");
}

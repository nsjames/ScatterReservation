const ScatterReservation = artifacts.require('./ScatterReservation.sol');
const ERC20 = artifacts.require('./ERC20.sol');
const DSToken = artifacts.require('./DSToken.sol');


contract('ScatterReservation', async accounts => {

  let scatter = null;

  const decimals = 1000000000000000000;
  const p = n => n*decimals;

  let gasCosts = [];
  let maxGas = {
    reserveUser:310000,
    reserveDapp:220000,
    dappDecision:200000,
    bid:210000,
    sell:150000
  }

  const testName = "helloworld";
  const testDappName = "hellochain";
  const badDappName = "badguy";

  const testKeys = [
    "EOS6U9WA3HUsP8BYJ8qiGqxFb9qkqAMEvUwVgdtiuTFTAj5qkvgi9",
    "EOS7inrrtWWojDfUFfriQvS5eNRG7GR9HzNXh9u2i3tAgc1oYd9YF"
  ];

  const fromA = {from:accounts[0]};
  const fromB = {from:accounts[1]};
  const fromC = {from:accounts[2]};

  const fromAWithValue = {from:accounts[0], value:p(0.1)};
  const fromBWithValue = {from:accounts[1], value:p(0.1)};
  const fromCWithValue = {from:accounts[2], value:p(0.1)};

  const signatoryKey = accounts[3];
  const fromSignatory = {from:signatoryKey};


  let eos = null;

  // const eos = (price) => {
  //   const eos = ERC20
  // }


  it('should get a reference to the contract', async () => {
    scatter = await ScatterReservation.deployed();
    assert(!!scatter);
  });

  it('should be able to set the signatory', async () => {
    await scatter.setSignatory(signatoryKey);
  });

  it('should not have the test name', async () => {
    const exists = await scatter.exists(testName);
    assert(!exists);
  });

  it('should set up an EOS token contract reference', async () => {
    const instance = await DSToken.new("EOS");
    await scatter.setEOSAddress(instance.address);
    const test = await instance.mint("1000000000000000000000000000");
    eos = ERC20.at(instance.address);
  });

  it('adding EOS allowances for testing', async () => {
    await eos.transfer(accounts[0], p(1000), fromA);
    await eos.transfer(accounts[1], p(1000), fromA);
    await eos.transfer(accounts[2], p(1000), fromA);
    await eos.approve(scatter.address, p(1000), fromA);
    await eos.approve(scatter.address, p(1000), fromB);
    await eos.approve(scatter.address, p(1000), fromC);
  });


    /**************************************/
    /*******      RESERVATIONS      *******/
    /**************************************/

    // USER IDENTITIES
    // ----------------------------------------------------------------

  it('should not be able to reserve an invalid user identity name', async () => {
    await scatter.reserveUser("a", testKeys[0]).catch(assert);
    await scatter.reserveUser("aa", testKeys[0]).catch(assert);
  });

  it('should not be able to force reserve a user identity name if not the signatory', async () => {
    await scatter.forceReservedName("scatter", fromB).catch(assert);
  });

  it('should be able to force reserve a user identity name', async () => {
    assert(await scatter.forceReservedName("scatter", fromSignatory) !== undefined);
    await scatter.reserveUser("scatter", testKeys[0]).catch(assert);
  });

  it('should be able to reserve a user identity', async () => {
    const result = await scatter.reserveUser(testName, testKeys[0], fromA);
    assert(await scatter.exists(testName), "Test name doesnt exist");
    assert(await scatter.reservationOwner(2) === accounts[0], "Wrong owner");
    assert(result.receipt.gasUsed < maxGas.reserveUser, "Too much gas used: " + result.receipt.gasUsed);
    gasCosts.push({fn:'reserveUser', gas:result.receipt.gasUsed});
  });

  it('should not be able to reserve the same user identity name twice', async () => {
    const result = await scatter.reserveUser(testName, testKeys[0]).catch(assert);
  });

  it('should not be able to reserve an identity with a bad key', async () => {
    const result = await scatter.reserveUser("goodname","badkey").catch(assert);
  });

  it('should not be able to reserve an identity with a bad name', async () => {
    const result = await scatter.reserveUser("",testKeys[0]).catch(assert);
  });

  it('should be able to reserve an identity with non-english characters', async () => {
    // Now on atomic ids 2 - 6
    // There is a problem with russian letters, they end up as an int of uppercase letters
    // assert(await scatter.reserveUser("щщщ",testKeys[0]) !== undefined, "Didnt accept russian");
    assert(await scatter.reserveUser("漢漢漢",testKeys[0]) !== undefined, "Didnt accept chinese");
    assert(await scatter.reserveUser("ééé",testKeys[0]) !== undefined, "Didnt accept spanish");
    assert(await scatter.reserveUser("כככ",testKeys[0]) !== undefined, "Didnt accept hebrew");
    assert(await scatter.reserveUser("ضضض",testKeys[0]) !== undefined, "Didnt accept arabic");
  });

    // DAPP IDENTITIES
    // ----------------------------------------------------------------

  it('should be able to reserve a dapp identity', async () => {
    // Now on atomic id 7
    const result = await scatter.reserveDapp(testDappName, testKeys[0], fromA);
    assert(await scatter.exists(testDappName));
    assert(await scatter.reservationOwner(3) === accounts[0]);
    assert(result.receipt.gasUsed < maxGas.reserveDapp, "Too much gas used: " + result.receipt.gasUsed);
    gasCosts.push({fn:'reserveDapp', gas:result.receipt.gasUsed});
  });

  it('should not be able to add the same dapp name twice', async () => {
    await scatter.reserveDapp(testDappName, testKeys[0], fromA).catch(assert);
  });

  it('should be able to approve the dapp from the signatory', async () => {
    let result = await scatter.dappDecision(7, true, fromSignatory);
    assert(await scatter.exists(testDappName), "Cant find name");
    assert(result.receipt.gasUsed < maxGas.dappDecision, "Too much gas used: " + result.receipt.gasUsed);
    gasCosts.push({fn:'dappDecision', gas:result.receipt.gasUsed});
  });

  it('should not be able to approve a dapp that has already been aproved', async () => {
    await scatter.dappDecision(7, true, fromSignatory).catch(assert);
  });

  it('should be able to deny a dapp reservation', async () => {
    assert(await scatter.reserveDapp(badDappName, testKeys[0], fromA) !== undefined);
    assert(await scatter.dappDecision(8, false, fromSignatory) !== undefined);
    assert(!await scatter.exists(badDappName));
  });

  it('should be able to re-reserve a dapp if it gets denied', async () => {
    assert(await scatter.reserveDapp(badDappName, testKeys[0], fromA) !== undefined);
    assert(await scatter.dappDecision(9, false, fromSignatory) !== undefined);
    assert(await scatter.reserveDapp(badDappName, testKeys[0], fromA) !== undefined);
  });



    /**************************************/
    /*******          BIDS          *******/
    /**************************************/

  it('should not allow the same account to bid on a reservation', async () => {
    await scatter.bid(2, testKeys[0], fromAWithValue).catch(assert)
  });

  it('should not allow bid which are below 0.01 ETH', async () => {
    await scatter.bid(2, testKeys[0], {from:accounts[1], value:p(0.001)}).catch(assert);
    await scatter.bid(2, testKeys[0], {from:accounts[1]}).catch(assert);
  });

  it('should not allow a different account to bid on a reservation with the same pkey', async () => {
    await scatter.bid(2, testKeys[0], fromBWithValue).catch(assert)
  });

  it('should be able to bid on a reservation from another account', async () => {
    const result = await scatter.bid(2, testKeys[1], fromBWithValue);
    assert(await scatter.bidOwner(2) === accounts[1]);
    assert(result.receipt.gasUsed < maxGas.bid, "Too much gas used: " + result.receipt.gasUsed);
    gasCosts.push({fn:'bid', gas:result.receipt.gasUsed});
  });

  it('should not be able to bid on a reservation with a bid lower than the previous', async () => {
    const result = await scatter.bid(2, testKeys[1], fromBWithValue).catch(assert)
  });



    /**************************************/
    /*******         UNBID          *******/
    /**************************************/
    // TODO: Need to create a sub contract with fast-forward capabilities
    // For now this has been tested manually. For now comment out the time
    // variable and flip this boolean
    const testingUnbid = false;

  it('should not be able to unbid a bid that is from another user', async () => {
    const result = await scatter.unBid(2, fromC).catch(assert);
  });

  it('should not be able to unbid a bid that does not exist', async () => {
    const result = await scatter.unBid(2, fromC).catch(assert);
  });

  if(!testingUnbid) it('should not be able to unbid a bid that is not yet stale', async () => {
    const result = await scatter.unBid(2, fromB).catch(assert);
  });

  if(testingUnbid) {
    it('should be able to unbid a bid', async () => {
      assert(await scatter.unBid(2, fromB) !== undefined);
      assert(await scatter.bidOwner(2) === '0x0000000000000000000000000000000000000000');
    });

    it('putting back bid that was unbid', async () => {
      const result = await scatter.bid(2, testKeys[1], fromBWithValue);
      assert(await scatter.bidOwner(2) === accounts[1]);
    });
  }



    /**************************************/
    /*******          SALE          *******/
    /**************************************/

  it('should not be able to sell from the wrong address', async () => {
    const result = await scatter.sell(1, fromB).catch(assert);
  });

  it('should not be able to sell a non existing reservation or bid', async () => {
    const result = await scatter.sell(2, fromB).catch(assert);
  });

  it('should be able to sell to the highest bid', async () => {
    const balanceBefore = await web3.eth.getBalance(accounts[0]);
    const balanceBBefore = await web3.eth.getBalance(accounts[1]);
    const result = await scatter.sell(2, fromA);
    assert(balanceBefore.c[0] < await web3.eth.getBalance(accounts[0]).c[0], "Seller did not get funds");
    assert(balanceBBefore.c[0] == await web3.eth.getBalance(accounts[1]).c[0], "Bidder funds changed");
    assert(await scatter.reservationOwner(2) === accounts[1], "wrong owner");
    assert(result.receipt.gasUsed < maxGas.sell, "Too much gas used: " + result.receipt.gasUsed);
    assert(await scatter.bidOwner(2) === '0x0000000000000000000000000000000000000000', "bidder still exists");
    gasCosts.push({fn:'sell', gas:result.receipt.gasUsed});
  });

  it('the next bid has to be greater than the last accepted bid', async () => {
    await scatter.bid(2, p(2), testKeys[0], fromA).catch(assert);
  });


    /**************************************/
    /*******          FLOW          *******/
    /**************************************/

    it('should be able to set chain launched to true', async () => {
      await scatter.setChainLaunched(true, fromA);
    });

    it('should not be able to reserve, bid, or sell after chain launch', async () => {
      await scatter.reserveUser("randomname", testKeys[1], fromB).catch(assert);
      await scatter.bid(3, testKeys[0], fromAWithValue).catch(assert);
      await scatter.sell(2, fromA).catch(assert);
    });


    /**************************************/
    /*******          END           *******/
    /**************************************/

  it('done', async () => {
    console.warn('------------------------------------------')
    console.warn("All Tests Pass!")
    console.warn('------------------------------------------')
    gasCosts.map(gas => {
      console.warn(gas);
    })
    console.warn('------------------------------------------')
  });


  // !NOPE! Create helpers for pulling out the data.
  // and for checking what you own based on EOS keys and ethereum keys
  // Edit: I took the time to do this, however it almost doubled the gas
  // costs for all methods. Not worth the overhead for users.
  // See, this is why we need EOS.

});

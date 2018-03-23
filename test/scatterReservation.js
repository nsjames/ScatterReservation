const ScatterReservation = artifacts.require('./ScatterReservation.sol');
const ERC20 = artifacts.require('./ERC20.sol');
const DSToken = artifacts.require('./DSToken.sol');


contract('ScatterReservation', async accounts => {

  let scatter = null;

  const decimals = 1000000000000000000;
  const p = n => n*decimals;

  let gasCosts = [];
  let maxGas = {
    reserve:310000,
    bid:210000,
    unbid:210000,
    sell:180000
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


  it('should get a reference to the contract', async () => {
    scatter = await ScatterReservation.deployed();
    assert(!!scatter);
  });

  it('should be able to set the signatory', async () => {
    await scatter.setSignatory(signatoryKey);
    assert(await scatter.getSignatory() === signatoryKey);
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
    await scatter.reserve("a", testKeys[0]).catch(assert);
    await scatter.reserve("aa", testKeys[0]).catch(assert);
  });

  it('should not be able to force reserve a user identity name if not the signatory', async () => {
    await scatter.forceReservedNames(["scatter"], fromB).catch(assert);
  });

  it('should be able to force reserve a user identity name', async () => {
    assert(await scatter.forceReservedNames(["scatter"], fromSignatory) !== undefined);
    await scatter.reserve("scatter", testKeys[0]).catch(assert);
  });

  it('should be able to force reserve an array of names', async () => {
    const names = ['test', 'test2', 'test3'];
    await scatter.forceReservedNames(names, fromSignatory);
    assert(await scatter.exists(names[0]));
    assert(await scatter.exists(names[1]));
    assert(await scatter.exists(names[2]));
  });

  it('should be able to reserve a user identity', async () => {
    const result = await scatter.reserve("prereserved", testKeys[0], fromA);
    assert(await scatter.exists("prereserved"), "Test name doesnt exist");
    assert(await scatter.reservationOwner(2) === accounts[0], "Wrong owner");
    assert(result.receipt.gasUsed < maxGas.reserve, "Too much gas used: " + result.receipt.gasUsed);
    gasCosts.push({fn:'reserve', gas:result.receipt.gasUsed});
  });

  it('should not be able to reserve the same user identity name twice', async () => {
    const result = await scatter.reserve("prereserved", testKeys[0]).catch(assert);
  });

  it('should not be able to reserve an identity with a bad key', async () => {
    const result = await scatter.reserve("goodname","badkey").catch(assert);
  });

  it('should not be able to reserve an identity with a bad name', async () => {
    const result = await scatter.reserve("",testKeys[0]).catch(assert);
  });

  it('should be able to reserve an identity with non-english characters', async () => {
    // Now on atomic ids 2 - 6
    // There is a problem with russian letters, they end up as an int of uppercase letters
    // assert(await scatter.reserve("щщщ",testKeys[0]) !== undefined, "Didnt accept russian");
    assert(await scatter.reserve("漢漢漢",testKeys[0]) !== undefined, "Didnt accept chinese");
    assert(await scatter.reserve("ééé",testKeys[0]) !== undefined, "Didnt accept spanish");
    assert(await scatter.reserve("כככ",testKeys[0]) !== undefined, "Didnt accept hebrew");
    assert(await scatter.reserve("ضضض",testKeys[0]) !== undefined, "Didnt accept arabic");
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
    const result = await scatter.sell(2, fromB).catch(assert);
  });

  it('should not be able to sell a non existing reservation or bid', async () => {
    const result = await scatter.sell(3, fromB).catch(assert);
  });

  it('should be able to sell to the highest bid', async () => {
    await scatter.reserve(testName, testKeys[0], fromA);
    const id = await scatter.currentId();
    const result = await scatter.bid(id, testKeys[1], fromBWithValue);
    const balanceBefore = await web3.eth.getBalance(accounts[0]);
    const balanceBBefore = await web3.eth.getBalance(accounts[1]);
    const saleResult = await scatter.sell(id, fromA);

    assert(balanceBefore.c[0] < await web3.eth.getBalance(accounts[0]).c[0], "Seller did not get funds");
    assert(balanceBBefore.c[0] == await web3.eth.getBalance(accounts[1]).c[0], "Bidder funds changed");
    assert(await scatter.reservationOwner(id) === accounts[1], "wrong owner");
    assert(result.receipt.gasUsed < maxGas.sell, "Too much gas used: " + result.receipt.gasUsed);
    assert(await scatter.bidOwner(id) === '0x0000000000000000000000000000000000000000', "bidder still exists");
    gasCosts.push({fn:'sell', gas:result.receipt.gasUsed});
  });

  it('the next bid has to be greater than the last accepted bid', async () => {
    await scatter.bid(2, p(2), testKeys[0], fromA).catch(assert);
  });


    /**************************************/
    /*******          FLOW          *******/
    /**************************************/

    it('setting a high bid to check transferrable', async () => {
      await scatter.reserve("highbid", testKeys[1], fromA);
      const nextId = await scatter.currentId();
      await scatter.bid(nextId, testKeys[0], {from:accounts[1], value:p(10)});
      await scatter.sell(nextId, fromA);
    });

    it('should be able to set chain launched to true', async () => {
      await scatter.setChainLaunched(true, fromA);
    });

    it('should not be able to reserve, bid, or sell after chain launch', async () => {
      await scatter.reserve("randomname", testKeys[1], fromB).catch(assert);
      await scatter.bid(3, testKeys[0], fromAWithValue).catch(assert);
      await scatter.sell(2, fromA).catch(assert);
    });

    it('should be able to check the transferrable funds, but only from signatory or owner', async () => {
      const transferrable = await scatter.getTransferrable(fromSignatory);
      assert(transferrable !== undefined);

      // Transferrable amount is greater than 1 ETH
      assert(transferrable.toString() > '1000000000000000000');
      await scatter.getTransferrable(fromB).catch(assert);
    });

    it('should be able to transfer out ETH funds using signatory account to any address', async () => {
      const balanceBefore = await web3.eth.getBalance(accounts[4]);
      const result = await scatter.transferEthOut(accounts[4], '1000000000000000000', fromSignatory);
      const balanceAfter = await web3.eth.getBalance(accounts[4]);
      assert(balanceAfter.toString() === balanceBefore.add(1000000000000000000).toString())

      assert(await scatter.transferEthOut(accounts[4], '1', fromB).catch(assert) === undefined);
    });

    it('should be able to transfer out EOS funds using signatory account to any address', async () => {
      const balanceBefore = await eos.balanceOf(accounts[1]);
      const result = await scatter.transferEosOut(accounts[1], '1000000000000000000', fromSignatory);
      const balanceAfter = await eos.balanceOf(accounts[1]);
      assert(balanceAfter.toString() === balanceBefore.add(1000000000000000000).toString(), "Balance B doesn't match");
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

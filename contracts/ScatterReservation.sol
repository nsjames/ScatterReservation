pragma solidity ^0.4.19;

contract ScatterReservation {

    // STRUCTS
    // ---------------------------------
    struct Reservation {
        uint id;
        bytes1 entityType;
        bytes24 name;
        bytes publicKey;
        uint priceReservedAt;
        bool transferring;
    }

    struct Bid {
        bytes publicKey;
        uint price;
        uint timestamp;
    }


    // STATE VARIABLES
    // ---------------------------------
    address private EOS;
    uint private bidTimeout = 2 days;

    address private owner;
    address private signatory;
    uint private reservationPrice;

    mapping (uint => address) private reservers;
    mapping (uint => Reservation) private reservations;
    mapping (uint => Reservation) private pendingReservations;

    mapping (uint => address) private bidders;
    mapping (uint => Bid) private bids;
    mapping (uint => uint) private lastSoldFor;

    mapping (bytes24 => uint) private names;
    mapping (bytes24 => uint) private pendingNames;

    uint private atomicResId;

    // CONSTRUCTOR
    // ---------------------------------
    function ScatterReservation(address _eos) public {
        EOS = _eos;
        owner = msg.sender;

        // Starting at one to be able to reserve names
        atomicResId = 1;

        // EOS price to reserve
        reservationPrice = 1000000000000000000;
    }


    // MODIFIERS
    modifier only(address _address){
        require(msg.sender == _address || owner == msg.sender);
        _;
    }

    modifier beforeChainLaunch() {
        //        require(now < now);
        _;
    }

    // EVENTS
    // ---------------------------------
    event EmitReservation(uint reservationId, bytes24 name, bytes pkey, address eth);
    event EmitPendingReservation(uint reservationId);
    event EmitDappDecision(uint reservationId);
    event EmitBid(uint reservationId, bytes pkey, uint price, address eth);
    event EmitUnBid(uint reservationId);
    event EmitSell(uint reservationId, uint price, bytes pkey, address eth);
    event EmitError(string msg);
    event EmitPrice(uint price);

    // READ
    // ---------------------------------
    function currentId() public constant returns (uint) {
        return atomicResId;
    }

    function exists(bytes24 name) public constant returns (bool) {
        return names[name] > 0 || pendingNames[name] > 0;
    }

    function reservationOwner(uint rId) public constant returns (address) {
        return reservers[rId];
    }

    function bidOwner(uint rId) public constant returns (address) {
        return bidders[rId];
    }


    // WRITE
    // ---------------------------------
    // Keeps all ether sent with no data present.
    function() public payable { }

    function setSignatory(address _signatory) public only(0x0) {
        signatory = _signatory;
    }

    function setEOSAddress(address _address) public only(signatory) {
        EOS = _address;
    }

    function setReservationPrice(uint _price) public only(signatory) {
        reservationPrice = _price;
    }

    function forceReservedName(bytes24 name) public only(signatory) {
        names[name] = 1;
    }

    function setBidTimeout(uint timeout) public only(signatory) {
        bidTimeout = timeout;
    }

    /***
     * Reserves a User Identity
     * */
    function reserveUser(bytes24 name, bytes pkey) public returns (uint) {
        require(validReservation(name,pkey));
        require(names[name] == 0);
        require(takeEOS(reservationPrice));
        atomicResId++;

        names[name] = atomicResId;
        reservers[atomicResId] = msg.sender;
        reservations[atomicResId] = Reservation(atomicResId, 0, name, pkey, reservationPrice, false);

        EmitReservation(atomicResId, name, pkey, msg.sender);
        return atomicResId;
    }

    /***
     * Reserves a Dapp Identity
     * */
    function reserveDapp(bytes24 name, bytes pkey) public returns (uint) {
        require(validReservation(name,pkey));
        require(pendingNames[name] == 0);
        require(takeEOS(reservationPrice));
        atomicResId++;

        pendingNames[name] = atomicResId;
        reservers[atomicResId] = msg.sender;
        pendingReservations[atomicResId] = Reservation(atomicResId, 1, name, pkey, reservationPrice, false);
        EmitPendingReservation(atomicResId);
        return atomicResId;
    }

    /***
     * Used for merging pending reservations with reservations
     * */
    function dappDecision(uint id, bool accepted) public only(signatory) {
        Reservation storage r = pendingReservations[id];
        require(r.id == id);

        if(accepted) {
            // Return funds to possible user owner
            if(names[r.name] > 0){
              uint rId = names[r.name];
              // Paying back EOS
              if(lastSoldFor[rId] == 0) giveEOS(reservers[rId], reservations[rId].priceReservedAt);
              // Paying back ETH
              else reservers[rId].transfer(lastSoldFor[id]);
            }

            reservations[id] = r;
            names[r.name] = id;
        }

        delete pendingNames[r.name];
        delete pendingReservations[id];
        EmitDappDecision(id);
    }

    /***
    * Bids on a reservation.
    */
    function bid(uint rId, bytes pkey) public payable returns (uint) {
        assert(reservers[rId] != msg.sender);
        assert(bidders[rId] != msg.sender);
        require(msg.value >= 10000000000000000);
        require(reservations[rId].id > 0);
        require(validPkey(pkey));
        require(!equalBytes(reservations[rId].publicKey, pkey));
        if(lastSoldFor[rId] > 0) require(lastSoldFor[rId] < msg.value);
        if(bids[rId].price > 0) {
          require(bids[rId].price < msg.value);
          bidders[rId].transfer(bids[rId].price);
        }

        bidders[rId] = msg.sender;
        bids[rId] = Bid(pkey, msg.value, now);
        EmitBid(rId, pkey, msg.value, msg.sender);
        return rId;
    }

    /***
    * Unbids on a stale reservation
    */
    function unBid(uint rId) public {
        assert(bidders[rId] == msg.sender);
        require(bids[rId].timestamp >= now + bidTimeout);

        // Returning funds
        bidders[rId].transfer(bids[rId].price);

        // Removing bid
        delete bids[rId];
        delete bidders[rId];

        EmitUnBid(rId);
    }

    function sell(uint rId) public {
        assert(reservations[rId].id > 0);
        assert(reservers[rId] == msg.sender);
        assert(!reservations[rId].transferring);
        require(bids[rId].price > 0);

        reservations[rId].transferring = true;
        if(!reservers[rId].send(bids[rId].price  - (bids[rId].price/10))){
            reservations[rId].transferring = false;
            return;
        }

        // Changing ownership
        reservations[rId].transferring = false;
        reservations[rId].publicKey = bids[rId].publicKey;
        reservers[rId] = bidders[rId];
        lastSoldFor[rId] = bids[rId].price;

        delete bids[rId];
        delete bidders[rId];

        EmitSell(rId, lastSoldFor[rId], reservations[rId].publicKey, reservers[rId]);
    }




    // EOS
    // ---------------------------------
    function takeEOS(uint price) internal returns(bool) {
        return true;
        require(price <= ERC20(EOS).allowance(msg.sender, this));
        if(!ERC20(EOS).transferFrom(msg.sender, this, price)){
            revert();
            return false;
        }
        return true;
    }

    function giveEOS(address to, uint price) internal returns(bool) {
        return true;
        if(!ERC20(EOS).transfer(to, price)){
            revert();
            return false;
        }
        return true;
    }



    // HELPERS
    // ---------------------------------
    function validReservation(bytes24 name, bytes pkey) internal pure returns (bool){
        require(nameLength(name) > 2 && nameLength(name) <= 20);
        require(isLower(name));
        validPkey(pkey);
        return true;
    }

    function validPkey(bytes pkey) internal pure returns (bool){
        assert(pkey.length > 30);
        return true;
    }

    function equalBytes(bytes a, bytes b) internal pure returns (bool) {
        return keccak256(a) == keccak256(b);
    }

    function isLower(bytes24 name) internal pure returns(bool){
      for (uint i = 0; i < name.length; i++) {
        if(name[i] == 32) return false;
  			if (name[i] >= 65 && name[i] <= 90) return false;
  		}
      return true;
    }

    function nameLength(bytes24 self) internal pure returns (uint length) {
      uint ret;
        if (self == 0) return 0;
        if (self & 0xffffffffffffffffffffffffffffffff == 0) {
            ret += 16;
            self = bytes24(uint(self) / 0x100000000000000000000000000000000);
        }
        if (self & 0xffffffffffffffff == 0) {
            ret += 8;
            self = bytes24(uint(self) / 0x10000000000000000);
        }
        if (self & 0xffffffff == 0) {
            ret += 4;
            self = bytes24(uint(self) / 0x100000000);
        }
        if (self & 0xffff == 0) {
            ret += 2;
            self = bytes24(uint(self) / 0x10000);
        }
        if (self & 0xff == 0) ret += 1;
        return 24 - ret;
    }

}

contract ERC20 {
    function totalSupply() public constant returns (uint supply);
    function balanceOf( address who ) public constant returns (uint value);
    function allowance( address owner, address spender ) public constant returns (uint _allowance);

    function transfer( address to, uint value) public returns (bool ok);
    function transferFrom( address from, address to, uint value) public returns (bool ok);
    function approve( address spender, uint value ) public returns (bool ok);

    event Transfer( address indexed from, address indexed to, uint value);
    event Approval( address indexed owner, address indexed spender, uint value);
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, ebool, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

interface IVotraWeightSource { function grantWeight(address saver, address drawEngine) external returns (euint64); }
interface IVotraReserve { function credit(uint256 drawId,address participant,ebool won) external; }

/// @notice Fixed-slot encrypted draw. The random target and winner bit never become public.
contract VotraDraw is ZamaEthereumConfig {
    IVotraWeightSource public immutable pool;
    uint64 public immutable slotSize;
    uint256 public round;
    euint64 private _random;
    bool public opened;
    address[] public participants;
    mapping(address => bool) public entered;
    address public immutable deployer;
    IVotraReserve public reserve;

    constructor(IVotraWeightSource pool_, uint64 slotSize_, uint256 round_) { require(slotSize_ > 0, "VOTRA: zero slot"); pool = pool_; slotSize = slotSize_; round = round_; deployer=msg.sender; }
    function setReserve(IVotraReserve reserve_) external {require(msg.sender==deployer&&address(reserve)==address(0),"VOTRA: reserve locked");reserve=reserve_;}
    function enter() external { require(!opened, "VOTRA: draw open"); if (!entered[msg.sender]) { entered[msg.sender] = true; participants.push(msg.sender); } }
    function open() external { require(!opened, "VOTRA: already open"); require(participants.length > 0, "VOTRA: no participants"); uint64 bound = _nextPowerOfTwo(uint64(participants.length) * slotSize); _random = FHE.randEuint64(bound); FHE.allowThis(_random); opened = true; }
    function winnerBit(uint256 index) external returns (ebool winner) { require(opened && index < participants.length, "VOTRA: invalid draw"); euint64 weight = pool.grantWeight(participants[index], address(this)); uint64 start = uint64(index) * slotSize; ebool afterStart = FHE.ge(_random, start); ebool beforeEnd = FHE.lt(_random, FHE.add(weight, start)); winner = FHE.and(afterStart, beforeEnd); FHE.allowThis(winner); FHE.allow(winner, participants[index]); }
    function settleParticipant(uint256 index) external returns(ebool winner){winner=this.winnerBit(index);FHE.allowTransient(winner,address(reserve));reserve.credit(round,participants[index],winner);}
    function participantCount() external view returns (uint256) { return participants.length; }
    function _nextPowerOfTwo(uint64 x) private pure returns (uint64 p) { p=x-1; p|=p>>1; p|=p>>2; p|=p>>4; p|=p>>8; p|=p>>16; p|=p>>32; p+=1; }
}

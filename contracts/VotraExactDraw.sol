// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, ebool, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

interface IVotraExactWeightSource { function grantWeight(address saver, address drawEngine) external returns (euint64); }
interface IVotraExactReserve { function credit(uint256 drawId, address participant, ebool won) external; }

/// @notice Bounded rejection-sampling draw over encrypted committed weights.
/// @dev MAX_TOTAL_WEIGHT is a public safety bound. Every accepted target is uniform
/// on [0, totalWeight); cumulative comparisons remain encrypted.
contract VotraExactDraw is ZamaEthereumConfig {
    IVotraExactWeightSource public immutable pool;
    uint64 public immutable maxTotalWeight;
    uint8 public immutable attempts;
    address[] public participants;
    mapping(address => bool) public entered;
    mapping(uint256 => bool) public settled;
    address public immutable deployer;
    IVotraExactReserve public reserve;
    euint64 private _target;
    ebool private _resolved;
    bool public opened;
    bool public exhausted;

    constructor(IVotraExactWeightSource pool_, uint64 maxTotalWeight_, uint8 attempts_) {
        require(address(pool_) != address(0) && maxTotalWeight_ > 0 && attempts_ > 0 && (maxTotalWeight_ & (maxTotalWeight_ - 1)) == 0, "VOTRA: invalid config");
        pool = pool_; maxTotalWeight = maxTotalWeight_; attempts = attempts_; deployer = msg.sender;
    }
    function setReserve(IVotraExactReserve reserve_) external { require(msg.sender == deployer && address(reserve) == address(0), "VOTRA: reserve locked"); require(address(reserve_) != address(0), "VOTRA: zero reserve"); reserve = reserve_; }
    function enter() external { require(!opened, "VOTRA: draw open"); if (!entered[msg.sender]) { entered[msg.sender] = true; participants.push(msg.sender); } }
    function open() external {
        require(!opened && participants.length > 0, "VOTRA: invalid open");
        euint64 total = FHE.asEuint64(0); euint64 selected = FHE.asEuint64(0); ebool found = FHE.asEbool(false);
        for (uint256 i = 0; i < participants.length; i++) total = FHE.add(total, pool.grantWeight(participants[i], address(this)));
        for (uint8 i = 0; i < attempts; i++) {
            euint64 candidate = FHE.randEuint64(maxTotalWeight);
            ebool accepted = FHE.lt(candidate, total);
            ebool choose = FHE.and(FHE.not(found), accepted);
            selected = FHE.select(choose, candidate, selected);
            found = FHE.or(found, accepted);
        }
        _target = selected; _resolved = found; opened = true; exhausted = false;
        FHE.allowThis(_target); FHE.allowThis(_resolved);
    }
    function winnerBit(uint256 index) external returns (ebool winner) {
        require(opened && index < participants.length, "VOTRA: invalid winner");
        euint64 cumulative = FHE.asEuint64(0); euint64 weight;
        for (uint256 i = 0; i <= index; i++) { weight = pool.grantWeight(participants[i], address(this)); cumulative = FHE.add(cumulative, weight); }
        euint64 previous = FHE.sub(cumulative, weight);
        winner = FHE.and(_resolved, FHE.and(FHE.ge(_target, previous), FHE.lt(_target, cumulative)));
        FHE.allowThis(winner); FHE.allow(winner, participants[index]);
    }
    function settleParticipant(uint256 index) external returns (ebool winner) {
        require(address(reserve) != address(0), "VOTRA: reserve unset");
        require(index < participants.length && !settled[index], "VOTRA: settled");
        settled[index] = true;
        winner = this.winnerBit(index);
        FHE.allowTransient(winner, address(reserve));
        reserve.credit(1, participants[index], winner);
    }
    function resolved() external view returns (ebool) { return _resolved; }
    function participantCount() external view returns (uint256) { return participants.length; }
}

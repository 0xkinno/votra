// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, ebool, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title VotraCommitmentPool
/// @notice Encrypted balance + encrypted commitment floor + forward-only committed weight.
/// @dev Every mutation accrues the OLD balance before changing it. Recovery is immediate for
/// future intervals; no operation can rewrite the already accumulated history.
contract VotraCommitmentPool is ZamaEthereumConfig {
    struct Saver {
        euint64 balance;
        euint64 floor;
        euint64 weight;
        euint64 breachCycles;
        ebool compliant;
        uint64 lastUpdate;
        bool registered;
        bool commitmentSet;
    }

    mapping(address => Saver) private _savers;
    uint256 public round;
    uint64 public immutable genesis;
    address public immutable deployer;
    address public authorizedDraw;

    event CommitmentSet(address indexed saver, uint256 indexed round);
    event BalanceChanged(address indexed saver, uint256 indexed round);

    constructor(uint256 round_) { round = round_; genesis = uint64(block.timestamp); deployer = msg.sender; }

    function setAuthorizedDraw(address draw) external { require(msg.sender == deployer, "VOTRA: deployer only"); require(authorizedDraw == address(0), "VOTRA: draw already set"); require(draw != address(0), "VOTRA: zero draw"); authorizedDraw = draw; }

    function setCommitment(externalEuint64 encryptedFloor, bytes calldata inputProof) external {
        Saver storage s = _savers[msg.sender];
        require(!s.commitmentSet, "VOTRA: commitment frozen");
        euint64 floor = FHE.fromExternal(encryptedFloor, inputProof);
        euint64 balance = _balance(s);
        s.floor = floor; s.commitmentSet = true;
        s.compliant = FHE.ge(balance, floor);
        FHE.allowThis(s.floor); FHE.allowThis(s.compliant); FHE.allow(s.floor, msg.sender); FHE.allow(s.compliant, msg.sender);
        _touch(s);
        emit CommitmentSet(msg.sender, round);
    }

    function deposit(externalEuint64 encryptedAmount, bytes calldata inputProof) external {
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        Saver storage s = _savers[msg.sender];
        _touch(s);
        euint64 next = FHE.add(_balance(s), amount);
        _setBalance(s, next);
        _updateCompliance(s, next);
        emit BalanceChanged(msg.sender, round);
    }

    function withdraw(externalEuint64 encryptedAmount, bytes calldata inputProof) external {
        euint64 requested = FHE.fromExternal(encryptedAmount, inputProof);
        Saver storage s = _savers[msg.sender];
        _touch(s);
        euint64 sent = FHE.min(requested, _balance(s));
        euint64 next = FHE.sub(_balance(s), sent);
        _setBalance(s, next);
        _updateCompliance(s, next);
        emit BalanceChanged(msg.sender, round);
    }

    function beginNextRound() external { round += 1; }

    function balanceOf(address saver) external view returns (euint64) { return _savers[saver].balance; }
    function floorOf(address saver) external view returns (euint64) { return _savers[saver].floor; }
    function weightOf(address saver) external view returns (euint64) { return _savers[saver].weight; }
    function breachCyclesOf(address saver) external view returns (euint64) { return _savers[saver].breachCycles; }
    function complianceOf(address saver) external view returns (ebool) { return _savers[saver].compliant; }

    /// @notice Grants a weight handle to a draw engine without making it public.
    function grantWeight(address saver, address drawEngine) external returns (euint64 weight) {
        require(msg.sender == authorizedDraw && drawEngine == authorizedDraw, "VOTRA: unauthorized draw");
        weight = _savers[saver].weight;
        FHE.allow(weight, drawEngine);
    }

    function _touch(Saver storage s) private {
        uint64 nowTs = uint64(block.timestamp);
        if (!s.registered) { s.registered = true; s.lastUpdate = nowTs; s.balance = FHE.asEuint64(0); s.weight = FHE.asEuint64(0); s.breachCycles = FHE.asEuint64(0); FHE.allowThis(s.balance); FHE.allowThis(s.weight); FHE.allowThis(s.breachCycles); return; }
        uint64 elapsed = nowTs - s.lastUpdate;
        if (elapsed > 0 && s.commitmentSet) {
            euint64 contribution = FHE.mul(_balance(s), elapsed);
            euint64 gated = FHE.select(s.compliant, contribution, FHE.asEuint64(0));
            s.weight = FHE.add(s.weight, gated); FHE.allowThis(s.weight); FHE.allow(s.weight, msg.sender);
        }
        s.lastUpdate = nowTs;
    }

    function _updateCompliance(Saver storage s, euint64 nextBalance) private {
        if (!s.commitmentSet) return;
        ebool next = FHE.ge(nextBalance, s.floor);
        ebool left = FHE.and(s.compliant, FHE.not(next));
        s.breachCycles = FHE.add(s.breachCycles, FHE.select(left, FHE.asEuint64(1), FHE.asEuint64(0)));
        s.compliant = next;
        FHE.allowThis(s.compliant); FHE.allow(s.compliant, msg.sender); FHE.allowThis(s.breachCycles); FHE.allow(s.breachCycles, msg.sender);
    }

    function _balance(Saver storage s) private returns (euint64 b) { b = s.balance; if (!FHE.isInitialized(b)) b = FHE.asEuint64(0); }
    function _setBalance(Saver storage s, euint64 next) private { s.balance = next; FHE.allowThis(next); FHE.allow(next, msg.sender); }
}

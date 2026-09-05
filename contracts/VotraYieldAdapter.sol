// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {euint64} from "@fhevm/solidity/lib/FHE.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";
import {IVotraYieldSource} from "./IVotraYieldSource.sol";

interface IVotraTestnetMintable {
    function mintDemo(uint64 amount) external returns (euint64);
}

/// @title VotraYieldAdapter
/// @notice Deterministic testnet yield source. It is not a live market strategy.
/// @dev Principal and realized yield are separate accounting quantities. Harvesting
/// can only transfer realized yield to the confidential prize reserve.
contract VotraYieldAdapter is IVotraYieldSource {
    IERC7984 public immutable asset;
    address public immutable reserve;
    address public immutable owner;
    uint256 private _principal;
    uint256 private _realizedYield;

    event PrincipalDeposited(uint256 amount, uint256 principal);
    event PrincipalWithdrawn(uint256 amount, uint256 principal);
    event YieldAccrued(uint256 amount, uint256 availableYield);
    event YieldHarvested(uint256 amount, address indexed reserve, uint256 indexed drawId);

    constructor(IERC7984 asset_, address reserve_) {
        require(address(asset_) != address(0) && reserve_ != address(0), "VOTRA: zero address");
        asset = asset_;
        reserve = reserve_;
        owner = msg.sender;
    }

    function depositPrincipal(uint256 amount) external onlyOwner {
        _principal += amount;
        emit PrincipalDeposited(amount, _principal);
    }

    function withdrawPrincipal(uint256 amount) external onlyOwner {
        require(amount <= _principal, "VOTRA: principal underflow");
        _principal -= amount;
        emit PrincipalWithdrawn(amount, _principal);
    }

    /// @notice Deterministic testnet hook standing in for realized external yield.
    function accrueYield(uint256 amount) external onlyOwner {
        _realizedYield += amount;
        emit YieldAccrued(amount, _realizedYield);
    }

    function harvestYield(uint64 amount, uint256 drawId) external onlyOwner {
        require(uint256(amount) <= _realizedYield, "VOTRA: yield underflow");
        _realizedYield -= amount;
        euint64 encryptedAmount = IVotraTestnetMintable(address(asset)).mintDemo(amount);
        asset.confidentialTransferAndCall(reserve, encryptedAmount, abi.encode(drawId));
        emit YieldHarvested(amount, reserve, drawId);
    }

    function currentAssets() external view returns (uint256) { return _principal + _realizedYield; }
    function availableYield() external view returns (uint256) { return _realizedYield; }

    modifier onlyOwner() { require(msg.sender == owner, "VOTRA: owner only"); _; }
}

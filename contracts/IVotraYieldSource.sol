// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

interface IVotraYieldSource {
    function depositPrincipal(uint256 amount) external;
    function withdrawPrincipal(uint256 amount) external;
    function harvestYield(uint64 amount, uint256 drawId) external;
    function currentAssets() external view returns (uint256);
    function availableYield() external view returns (uint256);
}

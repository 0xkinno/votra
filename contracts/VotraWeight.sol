// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
interface IVotraWeight { function commitmentFloor(bytes calldata encryptedFloor,bytes calldata proof) external; function accrueBeforeMutation() external; function committedWeight() external view returns(bytes32); }

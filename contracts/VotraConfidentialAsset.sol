// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;
import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";
contract VotraConfidentialAsset is ERC7984, ZamaEthereumConfig {
    constructor() ERC7984("VOTRA Confidential Demo USD", "vcUSD", "") {}
    function mintDemo(uint64 amount) external returns (euint64) { euint64 value=FHE.asEuint64(amount); FHE.allowThis(value); return _mint(msg.sender,value); }
    function mintEncrypted(address to, externalEuint64 amount, bytes calldata proof) external returns (euint64) { return _mint(to,FHE.fromExternal(amount,proof)); }
}

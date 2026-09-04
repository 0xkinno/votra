// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;
import {FHE, ebool, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";
import {IERC7984Receiver} from "@openzeppelin/confidential-contracts/interfaces/IERC7984Receiver.sol";
contract VotraPrizeReserve is IERC7984Receiver, ZamaEthereumConfig {
    IERC7984 public immutable asset; address public immutable draw;
    mapping(uint256=>euint64) private _prize; mapping(uint256=>mapping(address=>euint64)) private _credit; mapping(uint256=>mapping(address=>bool)) public claimed;
    constructor(IERC7984 asset_,address draw_){require(address(asset_)!=address(0)&&draw_!=address(0),"VOTRA: zero");asset=asset_;draw=draw_;}
    function onConfidentialTransferReceived(address,address,euint64 amount,bytes calldata data) external returns(ebool accepted){require(msg.sender==address(asset),"VOTRA: asset only");uint256 drawId=abi.decode(data,(uint256));euint64 prior=_prize[drawId];_prize[drawId]=FHE.isInitialized(prior)?FHE.add(prior,amount):amount;FHE.allowThis(_prize[drawId]);accepted=FHE.asEbool(true);FHE.allowThis(accepted);FHE.allowTransient(accepted,msg.sender);}
    function credit(uint256 drawId,address participant,ebool won) external {require(msg.sender==draw,"VOTRA: draw only");euint64 prize=_prize[drawId];if(!FHE.isInitialized(prize))prize=FHE.asEuint64(0);euint64 amount=FHE.select(won,prize,FHE.asEuint64(0));_credit[drawId][participant]=amount;FHE.allowThis(amount);FHE.allow(amount,participant);}
    function claim(uint256 drawId) external returns(euint64 sent){require(!claimed[drawId][msg.sender],"VOTRA: claimed");claimed[drawId][msg.sender]=true;euint64 amount=_credit[drawId][msg.sender];if(!FHE.isInitialized(amount)){amount=FHE.asEuint64(0);FHE.allowThis(amount);}FHE.allowTransient(amount,address(asset));sent=asset.confidentialTransfer(msg.sender,amount);}
    function prizeOf(uint256 drawId) external view returns(euint64){return _prize[drawId];} function creditOf(uint256 drawId,address participant) external view returns(euint64){return _credit[drawId][participant];}
}

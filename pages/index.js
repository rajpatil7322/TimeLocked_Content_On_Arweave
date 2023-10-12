import Head from 'next/head';
import styles from '../styles/Home.module.css';
import { ethers } from "ethers";
import LitJsSdk from 'lit-js-sdk'
import {useState,useRef } from 'react'  
import { WebBundlr } from '@bundlr-network/client';
import BigNumber from 'bignumber.js'

export default function Home() {

  const [key,setkey]=useState();
  const [encryptedstring,setEncryptedString]=useState();
  const [packdata,setPackdata]=useState();

  const[text,setText]=useState("");

  const [bundlrInstance,setbundlrInstance]=useState();

  const [time,setTime]=useState();

  const bundlrRef=useRef();


  async function Connect(){
    const provider=new ethers.providers.Web3Provider(window.ethereum);
    const current_block_number=await provider.getBlockNumber();
    const tt=(await provider.getBlock(current_block_number)).timestamp +10
    setTime(tt);

    const bundlr=new WebBundlr("https://devnet.bundlr.network","ethereum",provider);
    await bundlr.ready();
    setbundlrInstance(bundlr);
    bundlrRef.current=bundlr;
    fetchBalance();

    const client = new LitJsSdk.LitNodeClient();
    await client.connect(); 
    window.litNodeClient = client;
  }

  async function fetchBalance(){
    const bal=await bundlrRef.current.getLoadedBalance();
    console.log('bal: ',ethers.utils.formatEther(bal.toString()))
  }

  async function uploadFile(data_to_ar) {    
    let tx = await bundlrInstance.uploader.upload(data_to_ar)
    console.log('tx: ', tx)                   
    console.log(`http://arweave.net/${tx.data.id}`)
  }

  async function upload(){
    await uploadFile(packdata);
  }

  // var accessControlConditions = [
  //   {
  //     contractAddress: "",
  //     standardContractType: "",
  //     chain:"mumbai",
  //     method: "eth_getBalance",
  //     parameters: [":userAddress", "latest"],
  //     returnValueTest: {
  //       comparator: ">",
  //       value: "1000000000000000000",
  //     },
  //   },
  // ];

  var accessControlConditions = [
    {
      contractAddress: "",
      standardContractType: "timestamp",
      chain: "ethereum",
      method: "eth_getBlockByNumber",
      parameters: ["latest"],
      returnValueTest: {
        comparator: ">",
        value: ""+`${time}` 
      },  
    },
  ];

  var evmContractConditions=[
    {
      contractAddress: "0x2A53B58CC0968bfd000990A12BbCC7591a845594",
      functionName: "get",
      functionParams: [":userAddress"],
      functionAbi: {
        type: "function",
        stateMutability: "view",
        outputs: [
          {
            "internalType": "bool",
            "name": "",
            "type": "bool"
          }
        ],
        name:"get",
        inputs: [
          {
            "internalType": "address",
            "name": "_user",
            "type": "address"
          }
        ],
      },
      chain:"mumbai",
      returnValueTest: {
        key: "",
        comparator: "=",
        value: "true",
      },
    },
  ];
  const byteSize = str => new Blob([str]).size;

  function parseInput(input){
    const conv=new BigNumber(input).multipliedBy(bundlrInstance.currencyConfig.base[1]);
    if(conv.isLessThan(1)){
      console.log("error: value is too small")
      return
    }else{
      return conv
    }
  }

  async function fundWallet(size) {
    const price1MBAtomic = await bundlrInstance.getPrice(size);
    const price1MBConverted = bundlrInstance.utils.unitConverter(price1MBAtomic);
    console.log(`Uploading ${size} bytes to Bundlr costs $${price1MBConverted}`);
    const amountParsed = parseInput(price1MBConverted)
    let response = await bundlrInstance.fund(amountParsed)
    console.log('Wallet funded: ', response)
    fetchBalance()
  }


  async function encryptString(){
    const authSig = await LitJsSdk.checkAndSignAuthMessage({ chain: "ethereum" });
    const { encryptedString, symmetricKey } = await LitJsSdk.encryptString(text);

    setEncryptedString(encryptedString);

    const encryptedSymmetricKey = await window.litNodeClient.saveEncryptionKey({
      accessControlConditions,
      symmetricKey,
      authSig,
      chain:"ethereum",
    });

    setkey(LitJsSdk.uint8arrayToString(encryptedSymmetricKey, "base16"));

    const data=JSON.stringify({
      encryptedData:await blobToDataURI(encryptedString),
      encryptedSymmetricKey,
      accessControlConditions
    })
    setPackdata(data);
    console.log(data);
  }

  async function testFunding(){
    const size=byteSize(packdata);
    await fundWallet(size);
  }

  const blobToDataURI = (blob) => {
    return new Promise((resolve, reject) => {
        var reader = new FileReader();

        reader.onload = (e) => {
        var data = e.target.result;
        resolve(data);
        };
        reader.readAsDataURL(blob);
    });
  }

  async function decrypt(){
    const authSig = await LitJsSdk.checkAndSignAuthMessage({ chain: "ethereum" });
    const symmetricKey = await window.litNodeClient.getEncryptionKey({
      accessControlConditions ,
      toDecrypt: key,
      chain:"ethereum",
      authSig,
    });

  const decryptedString = await LitJsSdk.decryptString(
    encryptedstring,
    symmetricKey
  );

  console.log("Decrypted string",decryptedString);
  }

  function onChange(e) {
    setText(e.target.value)
  } 

  return (
    <div className={styles.container}>
      TimeLocked Content
      <div>
        <button onClick={Connect}>Connect</button>
        <br></br>
        <textarea
              onChange={onChange}
              placeholder="Encrypted post content"
          />
          <br>
          </br>
        <button onClick={encryptString}>Encrypt</button>
        <button onClick={testFunding}>FundWallet</button>
        <button onClick={decrypt}>Decrypt</button>
        <button onClick={upload}>UploadFile</button>
      </div>
      
    </div>
  );
}

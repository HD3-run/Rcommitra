const n=(r,e="INR")=>{const t=Number(r);return isNaN(t)||t===null||t===void 0?e==="INR"?"₹0.00":"$0.00":e==="INR"?`₹${t.toFixed(2)}`:`$${t.toFixed(2)}`};export{n as f};

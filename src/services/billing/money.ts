export const pesosToMinor=(value:number)=>{if(!Number.isFinite(value)||value<0)throw new Error("Invalid monetary value");return Math.round(value*100)};
export const formatPhp=(minor:number)=>new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP"}).format(minor/100);

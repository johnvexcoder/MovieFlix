"use client";import {useEffect,useState} from "react";import {useRouter} from "next/navigation";import {BillingCheckout} from "@/components/billing/billing-checkout";
export default function RegistrationPayment(){const router=useRouter(),[token,setToken]=useState("");useEffect(()=>{
// eslint-disable-next-line react-hooks/set-state-in-effect
const t=sessionStorage.getItem("movieflix_signup_token")||"";if(!t)router.replace("/register");else setToken(t)},[router]);if(!token)return null;return <main className="cinematic-bg min-h-screen w-full overflow-x-clip px-2.5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-white sm:px-6 sm:py-10"><BillingCheckout signupToken={token} onComplete={()=>sessionStorage.removeItem("movieflix_signup_token")}/></main>}

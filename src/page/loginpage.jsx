import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Login from "../layout/login/login";
import { Helmet } from "react-helmet-async";
import { signinwithemail } from "../service/Auth";
import { toast } from "react-toastify";
import logo from "/logo.png";

export const Loginpage = () => {
  const navigate = useNavigate();

  const handelsubmit = async (email, pass) => {
    const data = await signinwithemail(email, pass);
    if (data) {
      toast.success("Login successful");
      navigate("/dashboard");
    } else {
    }
  };
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6">
      <Helmet>
        <title>Login | NetMap</title>
        <meta name="description" content="Login to NetMap" />
        <link rel="canonical" href="/login" />
        <meta name="robots" content="index, follow" />
       
        <meta name="keywords" content="login, netmap" />
        <meta name="author" content="NetMap" />
        <meta name="language" content="EN" />
      </Helmet>
      <div className="w-full max-w-6xl flex flex-col lg:flex-row gap-8 lg:gap-12">
        <div className="w-full lg:w-1/2 flex justify-end items-center">
          <img src="/logo.png" alt="logo" className="max-w-full h-auto object-contain" />
        </div>
        <div className="w-full lg:w-1/2 xl:w-2/5 flex flex-col items-center justify-center">
          <Login onenter={handelsubmit} role="login" />
        </div>
      </div>
    </div>
  );
};

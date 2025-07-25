import React from 'react';
import { Link } from 'react-router-dom';
import './Home.css';

export default function Home() {
  return (
    <div className="home-content text-center px-4 pt-32">
      <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold mb-6 font-poppins">
        Welcome to AC Finance
      </h1>
      <p className="text-xl md:text-2xl lg:text-3xl max-w-3xl mx-auto font-raleway mb-8">
        Your one-stop microfinance partner. Invest, borrow, and grow — securely and efficiently.
      </p>

      <div className="button-row">
        <Link to="/about" className="soft-btn">
          Learn More
        </Link>
        <Link to="/investor/register" className="soft-btn">
          Get Started
        </Link>
      </div>
    </div>
  );
}

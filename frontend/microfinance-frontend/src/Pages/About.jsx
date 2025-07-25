// src/Pages/About.jsx
import React, { useState } from 'react';
import { Card, CardContent } from '../UI/card';
import {
  PieChart,
  Box,
  ArrowDownCircle,
  ArrowUpCircle
} from 'lucide-react';
import './About.css';

const tabs = [
  { key: 'invest', label: 'Investing' },
  { key: 'loan', label: 'Getting a Loan' },
  { key: 'withdraw', label: 'Withdrawing' },
  { key: 'repay', label: 'Repaying Loan' }
];

const content = {
  invest: {
    img: '/tab-invest.jpg',
    icon: PieChart,
    title: 'Smart Compound Investments',
    details: (
      <div className="details-box">
        <p>Choose your tier and duration, upload proof, and track monthly compounded returns.</p>
        <table className="info-table">
          <thead>
            <tr><th>Tier</th><th>1–3 mo</th><th>4–6 mo</th><th>7–12 mo</th></tr>
          </thead>
          <tbody>
            <tr><td>Small ($28–99)</td><td>8%</td><td>10%</td><td>12%</td></tr>
            <tr><td>Medium ($100–199)</td><td>10%</td><td>12%</td><td>13%</td></tr>
            <tr><td>Large ($200+)</td><td>12%</td><td>14%</td><td>15%</td></tr>
          </tbody>
        </table>
      </div>
    )
  },
  loan: {
    img: '/tab-loan.jpg',
    icon: Box,
    title: 'Fast Fixed-Rate Loans',
    details: (
      <div className="details-box">
        <h4>Approval Window</h4>
        <p>Loan applications are processed only between the <strong>28th and 8th</strong> of each month. Submissions outside this window are queued for the next cycle.</p>
        <p>Only approved investors apply online then visit the office during this period.</p>
        <table className="info-table">
          <thead>
            <tr><th>Tier</th><th>Interest Rate</th></tr>
          </thead>
          <tbody>
            <tr><td>Small ($28–99)</td><td>25%</td></tr>
            <tr><td>Medium ($100–349)</td><td>20%</td></tr>
            <tr><td>Large ($350+)</td><td>17%</td></tr>
          </tbody>
        </table>
      </div>
    )
  },
  withdraw: {
    img: '/tab-withdraw.jpg',
    icon: ArrowDownCircle,
    title: 'Seamless Withdrawals',
    details: (
      <div className="details-box">
        <h4>Withdrawal Window</h4>
        <p>Withdrawal requests are accepted only from the <strong>28th to the 8th</strong> of each month. Requests outside this period are deferred to the next cycle.</p>
        <p>Once approved, admin uploads payment proof and marks request as paid. Track status live.</p>
      </div>
    )
  },
  repay: {
    img: '/tab-repay.jpg',
    icon: ArrowUpCircle,
    title: 'Effortless Repayments',
    details: (
      <div className="details-box">
        <p>Upload repayment proof one month after approval. Admin verifies and updates status.</p>
      </div>
    )
  }
};

export default function About() {
  const [active, setActive] = useState('invest');
  const ActiveIcon = content[active].icon;

  return (
    <div className="about-container">
      <h2 className="about-title">How AC Finance Works</h2>
      <div className="tab-buttons">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            className={`tab-btn ${active === tab.key ? 'active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="about-content">
        <div className="about-image">
          <img src={content[active].img} alt={content[active].title} />
        </div>
        <div className="about-details">
          <div className="about-header">
            <ActiveIcon className="about-icon" />
            <h3 className="about-subtitle">{content[active].title}</h3>
          </div>
          <Card className="about-card">
            <CardContent>
              {content[active].details}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

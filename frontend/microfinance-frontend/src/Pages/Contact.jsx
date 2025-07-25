import React, { useState } from 'react';
import './Contact.css';

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });

  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
    setSubmitted(true);
    setFormData({ name: '', email: '', subject: '', message: '' });

    setTimeout(() => setSubmitted(false), 5000);
  };

  return (
    <div
      className="contact-page"
      style={{ backgroundPosition: 'center top' }}
    >
      <div className="contact-left">
        <h1>Contact Us</h1>
        <form onSubmit={handleSubmit} className="contact-form">
          <div className="form-group">
            <label>Name</label>
            <input
              type="text"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              placeholder="Your Name"
            />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              name="email"
              required
              value={formData.email}
              onChange={handleChange}
              placeholder="you@example.com"
            />
          </div>
          <div className="form-group">
            <label>Subject</label>
            <input
              type="text"
              name="subject"
              required
              value={formData.subject}
              onChange={handleChange}
              placeholder="Subject"
            />
          </div>
          <div className="form-group">
            <label>Message</label>
            <textarea
              name="message"
              required
              rows="5"
              value={formData.message}
              onChange={handleChange}
              placeholder="Your message..."
            />
          </div>
          <button type="submit">Send Message</button>
          {submitted && (
            <p className="success-message">
              Your message was submitted (simulated).
            </p>
          )}
        </form>
      </div>

      <div className="contact-right">
        <div className="contact-right-header">
          <h2>Get in Touch</h2>
        </div>
        <p className="contact-info">Email: support@acfinance.co.zw</p>
        <p className="contact-info">Phone: +263 772 123 456</p>
      </div>
    </div>
  );
}

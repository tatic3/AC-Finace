// src/Pages/InvestorRegister.jsx
import React, { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import debounce from 'lodash.debounce';
import { toast } from 'react-toastify';
import {
  Loader2,
  User,
  AtSign,
  Lock,
  Phone,
  FileText,
  ImageIcon as Image,
  CalendarCheck,
} from 'lucide-react';
import PublicNavbar from '../Pages/PublicNavbar';

export default function InvestorRegister() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    idNumber: '',
    address: '',
    nextOfKin: '',
    phoneOfKin: '',
    dob: '',
  });

  const [files, setFiles] = useState({
    facePhoto: null,
    idDocument: null,
    proofOfResidence: null,
  });

  const [loading, setLoading] = useState(false);

  const handleChange = e =>
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleFile = e =>
    setFiles(f => ({ ...f, [e.target.name]: e.target.files[0] }));

  const fireRegister = useCallback(
    debounce(async ({ fields, files }) => {
      const dataBody = new FormData();
      dataBody.append('full_name',       fields.fullName);
      dataBody.append('username',        fields.username);
      dataBody.append('email',           fields.email);
      dataBody.append('password',        fields.password);
      dataBody.append('phone',           fields.phone);
      dataBody.append('id_number',       fields.idNumber);
      dataBody.append('address',         fields.address);
      dataBody.append('next_of_kin',     fields.nextOfKin);
      dataBody.append('phone_of_kin',    fields.phoneOfKin);
      dataBody.append('dob',             fields.dob);

      dataBody.append('face_photo',         files.facePhoto);
      dataBody.append('id_document',        files.idDocument);
      dataBody.append('proof_of_residence', files.proofOfResidence);

      try {
        await api.post('/investor-register', dataBody, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast.success('Registration submitted! Awaiting approval.');
        navigate('/investor/login');
      } catch (err) {
        console.error(err);
        const msg = err.response?.data?.message || err.response?.data?.error || 'Registration failed';
        toast.error(`Error: ${msg}`);
      } finally {
        setLoading(false);
      }
    }, 300),
    [navigate]
  );

  const handleSubmit = e => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (!files.facePhoto || !files.idDocument || !files.proofOfResidence) {
      toast.error('Please upload all required documents');
      return;
    }
    setLoading(true);
    fireRegister({ fields: form, files });
  };

  return (
    <>
      <PublicNavbar />
      <div className="flex items-center justify-center min-h-screen p-4 bg-gray-50">
        <div className="w-full max-w-lg bg-white p-8 rounded-lg shadow">
          <h2 className="text-2xl font-semibold text-center mb-6">Investor Registration</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center border rounded px-3 py-2">
              <User className="mr-2" />
              <input
                type="text"
                name="fullName"
                placeholder="Full Name"
                value={form.fullName}
                onChange={handleChange}
                required
                className="w-full focus:outline-none"
              />
            </div>
            <div className="flex gap-4">
              <div className="flex-1 flex items-center border rounded px-3 py-2">
                <User className="mr-2" />
                <input
                  type="text"
                  name="username"
                  placeholder="Username"
                  value={form.username}
                  onChange={handleChange}
                  required
                  className="w-full focus:outline-none"
                />
              </div>
              <div className="flex-1 flex items-center border rounded px-3 py-2">
                <AtSign className="mr-2" />
                <input
                  type="email"
                  name="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={handleChange}
                  required
                  className="w-full focus:outline-none"
                />
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-1 flex items-center border rounded px-3 py-2">
                <Lock className="mr-2" />
                <input
                  type="password"
                  name="password"
                  placeholder="Password"
                  value={form.password}
                  onChange={handleChange}
                  required
                  className="w-full focus:outline-none"
                />
              </div>
              <div className="flex-1 flex items-center border rounded px-3 py-2">
                <Lock className="mr-2" />
                <input
                  type="password"
                  name="confirmPassword"
                  placeholder="Confirm Password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  required
                  className="w-full focus:outline-none"
                />
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-1 flex items-center border rounded px-3 py-2">
                <Phone className="mr-2" />
                <input
                  type="tel"
                  name="phone"
                  placeholder="+26377XXXXXXX"
                  pattern="\+263[0-9]{9}"
                  value={form.phone}
                  onChange={handleChange}
                  required
                  className="w-full focus:outline-none"
                />
              </div>
              <div className="flex-1 flex items-center border rounded px-3 py-2">
                <Phone className="mr-2" />
                <input
                  type="tel"
                  name="phoneOfKin"
                  placeholder="Next of Kin Phone"
                  pattern="\+263[0-9]{9}"
                  value={form.phoneOfKin}
                  onChange={handleChange}
                  className="w-full focus:outline-none"
                />
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-1 flex items-center border rounded px-3 py-2">
                <FileText className="mr-2" />
                <input
                  type="text"
                  name="idNumber"
                  placeholder="75-1234567A75"
                  pattern="75-[0-9]{6,7}[A-Z]75"
                  value={form.idNumber}
                  onChange={handleChange}
                  required
                  className="w-full focus:outline-none"
                />
              </div>
              <div className="flex-1 flex items-center border rounded px-3 py-2">
                <CalendarCheck className="mr-2" />
                <input
                  type="date"
                  name="dob"
                  value={form.dob}
                  onChange={handleChange}
                  required
                  className="w-full focus:outline-none"
                />
              </div>
            </div>
            <div className="flex gap-4">
              <input
                type="text"
                name="address"
                placeholder="Address"
                value={form.address}
                onChange={handleChange}
                required
                className="w-full border rounded px-3 py-2 focus:outline-none"
              />
              <input
                type="text"
                name="nextOfKin"
                placeholder="Next of Kin Name"
                value={form.nextOfKin}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2 focus:outline-none"
              />
            </div>
            {[
              { name: 'facePhoto', label: 'Face Photo' },
              { name: 'idDocument', label: 'ID Document' },
              { name: 'proofOfResidence', label: 'Proof of Residence' },
            ].map(({ name, label }) => (
              <div key={name}>
                <label className="block text-sm font-medium">{label}</label>
                <div className="flex items-center border rounded px-3 py-2 mt-1">
                  <Image className="mr-2" />
                  <input
                    type="file"
                    name={name}
                    accept="image/*,application/pdf"
                    onChange={handleFile}
                    required
                    className="w-full focus:outline-none"
                  />
                </div>
              </div>
            ))}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center py-2 bg-green-600 hover:bg-green-700 text-white rounded disabled:opacity-50"
            >
              {loading && <Loader2 className="animate-spin mr-2 h-5 w-5" />}
              Register
            </button>
          </form>
          <p className="mt-4 text-center text-sm">
            Already have an account?{' '}
            <Link to="/investor/login" className="text-green-600 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}

import React, { useState } from 'react';
import axios from 'axios';
import logo from './images/Byazo logo .jpg';
import './LoginScreen.css';

const API_BASE_URL = "https://byazo-milk-tracker.onrender.com";

function LoginScreen({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
        email,
        password
      });

      if (response.data && response.data.token) {
        // Save the token to local storage
        localStorage.setItem('token', response.data.token);
        
        // Pass user details back to the parent component
        if (onLoginSuccess) {
          onLoginSuccess(response.data.user);
        }
      } else {
        setError('Login failed: Invalid response from server.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err.response?.data?.message || 'Failed to connect to the login server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-wallpaper" />
      <div className="login-card">
        <img src={logo} alt="Byazo logo" className="login-logo" />
        <h2>Byazo Milk Tracker</h2>
        <p className="login-subtitle">Please sign in to access your dashboard</p>

        {error && <div className="login-alert error">{error}</div>}

        <form onSubmit={handleSubmit} className="login-form" autoComplete="off">
          <div className="login-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              className="login-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@byazo.com"
              required
              disabled={loading}
              autoComplete="off"
            />
          </div>

          <div className="login-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              className="login-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={loading}
              autoComplete="new-password"
            />
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginScreen;

import React, { useState } from 'react';

export interface CustomerFormData {
  name: string;
  email: string;
  phone: string;
  notes: string;
}

interface CustomerDetailsFormProps {
  onSubmit: (data: CustomerFormData) => void;
  isLoading: boolean;
  isCartEmpty: boolean;
  error?: string;
}

const CustomerDetailsForm: React.FC<CustomerDetailsFormProps> = ({
  onSubmit,
  isLoading,
  isCartEmpty,
  error,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ name, email, phone, notes });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold">Your Details</h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          required
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your full name"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          required
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Phone <span className="text-red-500">*</span>
        </label>
        <input
          type="tel"
          required
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+1 (555) 000-0000"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Order Notes
          <span className="text-gray-400 font-normal ml-1">(optional)</span>
        </label>
        <textarea
          rows={3}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] resize-none"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any special instructions for your order…"
        />
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button
        type="submit"
        className="w-full bg-[var(--brand-accent)] hover:opacity-90 text-[var(--brand-on-accent)] px-4 py-3 rounded-lg transition-colors font-medium disabled:opacity-50"
        disabled={isCartEmpty || isLoading}
      >
        {isLoading ? 'Loading…' : 'Continue to Payment'}
      </button>
    </form>
  );
};

export default CustomerDetailsForm;


import React from 'react';
import { Shield, Lock, FileText, AlertTriangle } from 'lucide-react';

const LegalLayout: React.FC<{ title: string; icon: React.ElementType; children: React.ReactNode }> = ({ title, icon: Icon, children }) => (
  <div className="max-w-4xl mx-auto px-4 py-12 min-h-screen animate-fade-in">
    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-8 md:p-12 shadow-2xl">
      <div className="flex items-center gap-4 mb-8 border-b border-[var(--border-color)] pb-6">
        <div className="bg-[rgb(var(--primary-color))]/10 p-3 rounded-xl">
          <Icon className="w-8 h-8 text-[rgb(var(--primary-color))]" />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-[var(--text-main)]">{title}</h1>
      </div>
      
      <div className="prose prose-invert max-w-none text-[var(--text-muted)] space-y-6">
        {children}
      </div>

      <div className="mt-12 pt-8 border-t border-[var(--border-color)]">
        <blockquote className="bg-gradient-to-r from-[rgb(var(--primary-color))]/10 to-transparent border-l-4 border-[rgb(var(--primary-color))] p-6 rounded-r-xl">
          <p className="text-xl md:text-2xl font-black text-[var(--text-main)] italic tracking-wide leading-relaxed">
            "If buying isn't owning, then piracy isn't stealing."
          </p>
        </blockquote>
      </div>
    </div>
  </div>
);

export const DMCA: React.FC = () => (
  <LegalLayout title="DMCA Policy" icon={AlertTriangle}>
    <p><strong>Digital Millennium Copyright Act Notification Guidelines</strong></p>
    <p>
      StreamHub respects the intellectual property rights of others and expects its users to do the same. 
      StreamHub is essentially a search engine and discovery platform. We do not host, upload, or store any video files, media clips, or copyrighted content on our servers.
    </p>
    <p>
      The content displayed on this website is scraped from public sources and 3rd party networks. 
      StreamHub has no control over the content found on these external sources.
    </p>
    <h3>Notification of Infringement</h3>
    <p>
      If you believe that your copyrighted work has been copied in a way that constitutes copyright infringement and is accessible on this site, 
      you may notify our copyright agent. Please note that because we do not host content, we can only remove links/metadata from our index, 
      not the actual file from the third-party host.
    </p>
    <p>
      To file a notice, please provide:
    </p>
    <ul className="list-disc pl-5 space-y-2">
      <li>A physical or electronic signature of a person authorized to act on behalf of the owner of an exclusive right that is allegedly infringed.</li>
      <li>Identification of the copyrighted work claimed to have been infringed.</li>
      <li>Identification of the material that is claimed to be infringing.</li>
      <li>Information reasonably sufficient to permit the service provider to contact the complaining party.</li>
    </ul>
  </LegalLayout>
);

export const Privacy: React.FC = () => (
  <LegalLayout title="Privacy Policy" icon={Lock}>
    <h3>Data Collection</h3>
    <p>
      StreamHub is designed with privacy as a core principle. We do not require account registration to use the basic discovery features.
      When you use our application, we do not collect personally identifiable information (PII) such as your name, email address, or phone number.
    </p>
    
    <h3>Local Storage</h3>
    <p>
      This application relies heavily on your browser's <strong>Local Storage</strong> to function. 
      Your "Watchlist", "History", and "Settings" are stored entirely on your own device. 
      This data is never transmitted to our servers. If you clear your browser cache, this data will be lost.
    </p>

    <h3>Third-Party Services</h3>
    <p>
      We use third-party APIs (such as TMDB) to fetch metadata. When you load images or data, your IP address may be visible to these third-party providers 
      as part of the standard HTTP request process. We do not control how these providers handle your data.
    </p>

    <h3>Cookies</h3>
    <p>
      We do not use tracking cookies for advertising purposes. We may use essential storage mechanisms to remember your theme preference and configuration settings.
    </p>
  </LegalLayout>
);

export const Terms: React.FC = () => (
  <LegalLayout title="Terms of Service" icon={FileText}>
    <h3>1. Acceptance of Terms</h3>
    <p>
      By accessing and using StreamHub, you accept and agree to be bound by the terms and provision of this agreement. 
      If you do not agree to abide by these terms, please do not use this service.
    </p>

    <h3>2. Disclaimer of Warranties</h3>
    <p>
      This site is provided on an "AS IS" and "AS AVAILABLE" basis. StreamHub makes no representations or warranties of any kind, 
      express or implied, regarding the use or the results of this web site in terms of its correctness, accuracy, reliability, or otherwise.
    </p>

    <h3>3. Limitation of Liability</h3>
    <p>
      StreamHub shall not be liable for any damages whatsoever, and in particular StreamHub shall not be liable for any special, indirect, 
      consequential, or incidental damages, or damages for lost profits, loss of revenue, or loss of use, arising out of or related to this web site or the information contained in it.
    </p>

    <h3>4. Educational Purpose</h3>
    <p>
      This project is created for educational purposes to demonstrate modern web development technologies (React, TypeScript, API Integration). 
      It is not intended for commercial use.
    </p>
  </LegalLayout>
);

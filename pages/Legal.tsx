
import React from 'react';
import { Shield, Lock, FileText, AlertTriangle } from 'lucide-react';

const CONTACT_EMAIL = 'streamhub.dmca@proton.me';
const LAST_UPDATED = 'November 2026';

const LegalLayout: React.FC<{ title: string; icon: React.ElementType; children: React.ReactNode }> = ({ title, icon: Icon, children }) => (
  <div className="relative max-w-4xl mx-auto px-4 py-12 sm:py-16 min-h-screen animate-fade-in">
    {/* Ambient glow */}
    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-[rgb(var(--primary-color))]/10 blur-[120px] pointer-events-none" />
    <div className="relative bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-7 sm:p-10 md:p-12 shadow-2xl overflow-hidden">
      {/* Top accent line */}
      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-[rgb(var(--primary-color))] to-transparent opacity-70" />

      <div className="flex items-center gap-5 mb-10 border-b border-[var(--border-color)] pb-8">
        <div className="relative shrink-0">
          <div className="absolute inset-0 bg-[rgb(var(--primary-color))]/30 blur-xl rounded-2xl" />
          <div className="relative bg-gradient-to-br from-[rgb(var(--primary-color))]/25 to-[rgb(var(--primary-color))]/5 border border-[rgb(var(--primary-color))]/30 p-4 rounded-2xl">
            <Icon className="w-8 h-8 text-[rgb(var(--primary-color))]" />
          </div>
        </div>
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-[var(--text-main)] tracking-tight">{title}</h1>
          <p className="text-xs text-[var(--text-muted)] mt-1.5 flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[rgb(var(--primary-color))]" />
            Last updated: {LAST_UPDATED}
          </p>
        </div>
      </div>

      <div className="legal-content space-y-7 text-[var(--text-muted)]">
        {children}
      </div>

      <style>{`
        .legal-content h3 {
          display: flex; align-items: center; gap: 10px;
          font-size: 1.05rem; font-weight: 800; color: var(--text-main);
          letter-spacing: -0.01em; margin-top: 0;
        }
        .legal-content h3::before {
          content: ''; width: 4px; height: 18px; border-radius: 99px;
          background: rgb(var(--primary-color)); flex-shrink: 0;
        }
        .legal-content p { line-height: 1.75; font-size: 0.925rem; }
        .legal-content ul { list-style: none; padding-left: 0; display: flex; flex-direction: column; gap: 0.6rem; }
        .legal-content ul li {
          position: relative; padding-left: 1.6rem; line-height: 1.65; font-size: 0.9rem;
        }
        .legal-content ul li::before {
          content: ''; position: absolute; left: 0; top: 0.55em;
          width: 7px; height: 7px; border-radius: 2px;
          background: rgb(var(--primary-color) / 0.55);
          transform: rotate(45deg);
        }
        .legal-content strong { color: var(--text-main); font-weight: 700; }
        .legal-content em { color: var(--text-main); font-style: italic; }
        .legal-content a { color: rgb(var(--primary-color)); text-decoration: none; }
        .legal-content a:hover { text-decoration: underline; }
      `}</style>

      <div className="mt-12 pt-8 border-t border-[var(--border-color)]">
        <div className="bg-[var(--bg-main)]/60 border border-[var(--border-subtle)] p-6 rounded-xl">
          <h3 className="text-sm font-bold text-[var(--text-main)] mb-2">Questions or concerns?</h3>
          <p className="text-sm text-[var(--text-muted)] leading-relaxed">
            Contact us at <span className="text-[rgb(var(--primary-color))] font-semibold">{CONTACT_EMAIL}</span> or open an issue on our{' '}
            <a
              href="https://github.com/anassar12jS/streamsxainy-site/issues"
              target="_blank"
              rel="noreferrer"
              className="text-[rgb(var(--primary-color))] hover:underline"
            >
              public repository
            </a>
            . We aim to respond within 5–7 business days.
          </p>
        </div>
        <p className="text-[11px] text-[var(--text-muted)]/60 mt-6 text-center">
          This page is provided for general information and does not constitute legal advice.
        </p>
      </div>
    </div>
  </div>
);

export const DMCA: React.FC = () => (
  <LegalLayout title="DMCA Policy" icon={AlertTriangle}>
    <h3>1. Overview</h3>
    <p>
      StreamHub respects the intellectual property rights of others and expects its users to do the same.
      StreamHub is a discovery and playback-aggregation platform: we do not host, upload, store, or transmit
      video files on our own servers. Playback is provided through embedded third-party players and publicly
      accessible stream sources, over which we exercise no control.
    </p>
    <p>
      Because we do not host the underlying content, we cannot remove an infringing file from its origin host.
      What we <em>can</em> do — and will do promptly upon a valid notice — is remove the page, metadata, and
      links on StreamHub that reference the allegedly infringing material.
    </p>

    <h3>2. Filing a Takedown Notice</h3>
    <p>
      If you believe content accessible through StreamHub infringes your copyright, send a written notice to{' '}
      <strong>{CONTACT_EMAIL}</strong> containing <strong>all</strong> of the following (per 17 U.S.C. § 512(c)(3)):
    </p>
    <ul className="list-disc pl-5 space-y-2">
      <li>Your physical or electronic signature, or that of a person authorized to act on behalf of the copyright owner.</li>
      <li>Identification of the copyrighted work claimed to be infringed (e.g., title, registration number, or URL).</li>
      <li>Identification of the infringing material with enough detail for us to locate it — including the StreamHub page URL(s) and the title/identifier of the content.</li>
      <li>Your contact information: name, mailing address, telephone number, and email address.</li>
      <li>A statement that you have a good-faith belief that use of the material is not authorized by the copyright owner, its agent, or the law.</li>
      <li>A statement, made under penalty of perjury, that the information in your notice is accurate and that you are the copyright owner or authorized to act on their behalf.</li>
    </ul>
    <p>
      Notices missing any of these elements may not be actionable and may be disregarded. We respond to
      compliant notices within <strong>5–7 business days</strong>.
    </p>

    <h3>3. Counter-Notification</h3>
    <p>
      If you believe material was removed in error or misidentification, you may send a counter-notice to{' '}
      <strong>{CONTACT_EMAIL}</strong> including: your signature; identification of the removed material and
      its prior location; a statement under penalty of perjury that you have a good-faith belief the removal
      was a mistake; your contact information; and consent to the jurisdiction of the federal district court
      for your address (or, if outside the US, any district where StreamHub may be found).
    </p>

    <h3>4. Repeat Infringers</h3>
    <p>
      We maintain a policy of terminating, where appropriate, users or repeat partners who are the subject of
      multiple valid infringement notifications. Because StreamHub does not require user accounts, enforcement
      applies to any channel (including our public repository) used to report or distribute links.
    </p>
  </LegalLayout>
);

export const Privacy: React.FC = () => (
  <LegalLayout title="Privacy Policy" icon={Lock}>
    <h3>1. What We Collect</h3>
    <p>
      StreamHub requires no account registration. We do not knowingly collect names, email addresses, or other
      directly identifying information for core browsing. Data we do handle:
    </p>
    <ul className="list-disc pl-5 space-y-2">
      <li><strong>Local storage:</strong> watchlist, viewing history, playback progress, settings, theme, and provider preferences — stored entirely in your browser and never transmitted to us.</li>
      <li><strong>Companion extension data:</strong> if you install the Xainy Music extension, it reads your YouTube/Spotify session cookies <em>locally in your browser</em> to enable account features. Credentials are not sent to StreamHub servers.</li>
      <li><strong>Listen Together rooms:</strong> if you join a sync room, room state (track, position, chat messages) is stored via our Supabase backend and visible to other participants in that room.</li>
      <li><strong>Server logs:</strong> like any website, our hosting provider (Vercel) processes standard request metadata (IP address, user agent, timestamps) for delivery, security, and abuse prevention.</li>
    </ul>

    <h3>2. Third-Party Embeds & Trackers</h3>
    <p>
      Video playback is delivered through <strong>third-party embedded players</strong> (e.g., VidSrc, VidLink,
      iShowStream, and similar services). These embeds may set their own cookies, run analytics, or log your IP
      address and viewing activity under <em>their</em> privacy policies — StreamHub cannot control or accept
      responsibility for their data practices. We recommend reviewing the privacy policy of any embed provider
      you use, or using an ad/tracker blocker.
    </p>
    <p>
      Metadata and artwork are fetched from TMDB and related public APIs; your IP is visible to them as part of
      ordinary HTTP requests.
    </p>

    <h3>3. Cookies</h3>
    <p>
      We do not use advertising or cross-site tracking cookies. We use essential browser storage for theme,
      settings, and playback state. Third-party embeds may set their own cookies as noted above.
    </p>

    <h3>4. Children's Privacy</h3>
    <p>
      StreamHub is not directed at children under 13 and we do not knowingly collect personal information from
      children. Some embedded content may be age-restricted; parental discretion is advised.
    </p>

    <h3>5. Your Choices & Rights</h3>
    <p>
      You can clear all locally stored data at any time via your browser settings. Depending on your
      jurisdiction (e.g., GDPR/CCPA), you may have rights to access, correct, or delete personal data —
      contact us at <strong>{CONTACT_EMAIL}</strong> to exercise them. Because we hold no account profiles,
      most requests are limited to server-log data held by our processors.
    </p>
  </LegalLayout>
);

export const Terms: React.FC = () => (
  <LegalLayout title="Terms of Service" icon={FileText}>
    <h3>1. Acceptance of Terms</h3>
    <p>
      By accessing and using StreamHub, you agree to be bound by these Terms. If you do not agree, do not use
      the service. You must be at least 13 years old (or the age of digital consent in your jurisdiction) to use
      StreamHub.
    </p>

    <h3>2. The Service</h3>
    <p>
      StreamHub aggregates metadata and provides playback through third-party embed providers. We do not own,
      host, or distribute any video content, and make no warranties regarding the availability, legality, or
      quality of third-party streams. Features may change or be discontinued at any time.
    </p>

    <h3>3. Acceptable Use</h3>
    <p>You agree not to:</p>
    <ul className="list-disc pl-5 space-y-2">
      <li>Use the service for any unlawful purpose or to infringe intellectual-property rights.</li>
      <li>Scrape, overload, reverse-engineer, or interfere with the service's infrastructure or APIs.</li>
      <li>Resell, republish, or commercially exploit content accessed through StreamHub.</li>
      <li>Use Listen Together or other social features to harass, abuse, or impersonate others.</li>
    </ul>

    <h3>4. Intellectual Property & Copyright</h3>
    <p>
      Metadata, artwork, and listings are sourced from TMDB and similar providers and remain the property of
      their respective owners. If you believe content on StreamHub infringes your rights, see our{' '}
      <a href="/dmca" className="text-[rgb(var(--primary-color))] hover:underline">DMCA Policy</a> for the
      takedown process. We terminate access for repeat infringers where applicable.
    </p>

    <h3>5. Disclaimer of Warranties</h3>
    <p>
      The service is provided "AS IS" and "AS AVAILABLE" without warranties of any kind, express or implied,
      including merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that
      streams will be available, uninterrupted, or of any particular quality.
    </p>

    <h3>6. Limitation of Liability</h3>
    <p>
      To the maximum extent permitted by law, StreamHub and its operators shall not be liable for any indirect,
      incidental, special, consequential, or punitive damages, or for lost profits, data, or goodwill, arising
      from your use of the service.
    </p>

    <h3>7. Third-Party Services</h3>
    <p>
      StreamHub relies on third-party services (TMDB, embed providers, Supabase, Vercel, and optionally the
      companion browser extension). Your use of those services is governed by their own terms and privacy
      policies; we are not responsible for their acts or omissions.
    </p>

    <h3>8. Changes to These Terms</h3>
    <p>
      We may update these Terms from time to time. Continued use of StreamHub after changes take effect
      constitutes acceptance. Material changes will be reflected by the "Last updated" date above.
    </p>

    <h3>9. Governing Law</h3>
    <p>
      These Terms are governed by the laws of the jurisdiction in which the operator resides, without regard to
      conflict-of-law principles. Any disputes shall be resolved in the competent courts of that jurisdiction,
      unless mandatory consumer-protection law in your country provides otherwise.
    </p>
  </LegalLayout>
);

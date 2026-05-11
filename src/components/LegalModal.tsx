import React, { useEffect } from 'react'
import { BrutalIcon } from './BrutalIcon'

export type LegalModalType = 'terms' | 'privacy' | 'about' | null

interface LegalModalProps {
  type: LegalModalType
  onClose: () => void
}

const ABOUT_URL = 'https://crackedstudios.xyz'
const SUPPORT_EMAIL = 'studioscracked@gmail.com'

const MODAL_META: Record<Exclude<LegalModalType, null>, { title: string; subtitle: string; pdfHref?: string }> = {
  terms:   { title: 'TERMS OF USE',     subtitle: 'LAST UPDATED: MAY 5, 2026',   pdfHref: '/blokaz-terms.pdf'   },
  privacy: { title: 'PRIVACY POLICY',   subtitle: 'LAST UPDATED: MAY 5, 2026',   pdfHref: '/blokaz-privacy.pdf' },
  about:   { title: 'ABOUT',            subtitle: 'CRACKED STUDIOS' },
}

const LegalModal: React.FC<LegalModalProps> = ({ type, onClose }) => {
  const isOpen = type !== null

  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!type) return null
  const meta = MODAL_META[type]

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[210]"
        style={{ background: 'rgba(0,0,0,0.65)' }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={meta.title}
        className="fixed bottom-0 left-0 right-0 z-[220] flex flex-col"
        style={{
          height: type === 'about' ? 'auto' : '90dvh',
          maxHeight: '90dvh',
          background: 'var(--paper)',
          borderTop: '4px solid var(--ink)',
          borderLeft: '4px solid var(--ink)',
          borderRight: '4px solid var(--ink)',
          boxShadow: '0 -8px 0 var(--shadow)',
          animation: 'legalSlideUp 280ms cubic-bezier(0.22,1,0.36,1) both',
        }}
      >
        {/* Header */}
        <div
          className="flex shrink-0 items-center justify-between border-b-4 border-ink px-5 py-4"
          style={{ background: 'var(--ink)' }}
        >
          <div>
            <div className="font-display text-paper" style={{ fontSize: 18, letterSpacing: '-0.02em', lineHeight: 1 }}>
              {meta.title}
            </div>
            <div className="mt-1 font-display text-[9px] tracking-[0.2em]" style={{ color: 'rgba(255,255,255,0.45)' }}>
              {meta.subtitle}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center border-[3px] border-paper font-display text-paper transition-opacity active:opacity-60"
            style={{ background: 'transparent' }}
            aria-label="Close"
          >
            <BrutalIcon name="close" size={16} strokeWidth={2.5} />
          </button>
        </div>

        {/* Body */}
        {type === 'about'   ? <AboutBody onClose={onClose} /> :
         type === 'terms'   ? <ScrollBody pdfHref={meta.pdfHref!}><TermsContent /></ScrollBody> :
                              <ScrollBody pdfHref={meta.pdfHref!}><PrivacyContent /></ScrollBody>}
      </div>

      <style>{`
        @keyframes legalSlideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </>
  )
}

/* ── Scroll wrapper with PDF fallback link ──────────────────────────────────── */

const ScrollBody: React.FC<{ pdfHref: string; children: React.ReactNode }> = ({ pdfHref, children }) => (
  <div className="flex min-h-0 flex-1 flex-col">
    <div className="flex-1 overflow-y-auto px-5 py-5 text-ink" style={{ WebkitOverflowScrolling: 'touch' }}>
      {children}
    </div>
    <div className="shrink-0 border-t-4 border-ink px-5 py-3" style={{ background: 'var(--paper-2)' }}>
      <a
        href={pdfHref}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 font-display text-[10px] uppercase tracking-[0.14em]"
        style={{ color: 'var(--ink-soft)' }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" aria-hidden="true">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
        DOWNLOAD PDF
      </a>
    </div>
  </div>
)

/* ── Shared typography helpers ──────────────────────────────────────────────── */

const H2: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="mb-2 mt-6 font-display text-[13px] uppercase tracking-[0.12em]" style={{ color: 'var(--ink)' }}>
    {children}
  </h2>
)

const P: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="mb-3 font-body text-[12px] leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
    {children}
  </p>
)

const Ul: React.FC<{ items: React.ReactNode[] }> = ({ items }) => (
  <ul className="mb-3 ml-3 space-y-1.5">
    {items.map((item, i) => (
      <li key={i} className="flex gap-2 font-body text-[12px] leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
        <span className="mt-[3px] shrink-0 text-[8px]" style={{ color: 'var(--ink)' }}>■</span>
        <span>{item}</span>
      </li>
    ))}
  </ul>
)

const Email: React.FC<{ addr: string }> = ({ addr }) => (
  <a href={`mailto:${addr}`} className="underline" style={{ color: 'var(--ink)' }}>{addr}</a>
)

const Rule: React.FC = () => (
  <div className="my-4" style={{ height: 2, background: 'var(--rule)' }} />
)

/* ── Terms of Service content ───────────────────────────────────────────────── */

const TermsContent: React.FC = () => (
  <div>
    <P>
      Cracked Studio ("Cracked Studio," "we," "us," or "our") is a game developer and publisher
      that provides games, features, content, and services to users via websites, mobile applications,
      and other channels or platforms (the "Services"), including but not limited to Blokaz on the
      Minipay platform. These Terms of Use (the "Terms") form a legally binding agreement between
      you and Cracked Studio. Please read these Terms carefully before installing, accessing, or using
      the Services. By installing, accessing, or using the Services, you agree to these Terms. If you
      do not agree, do not use the Services.
    </P>

    <Rule />

    <H2>1. Definitions</H2>
    <P>In these Terms, unless the context otherwise requires:</P>
    <Ul items={[
      <><strong>"Account"</strong> means an account created by the User directly or through a third-party platform (including Minipay) for the purpose of accessing and using the Services.</>,
      <><strong>"Content"</strong> includes, without limitation, text, images, audio, video, graphics, data, source code, in-game items, cryptocurrency rewards, and any other materials or information displayed in or made available through the Services.</>,
      <><strong>"Services"</strong> means all games, applications, software, features, content, websites, customer support services, and any other related services provided or operated by Cracked Studio, including Blokaz on the Minipay platform.</>,
      <><strong>"User"</strong> or "you" means any individual who accesses, installs, registers for, uses, or otherwise interacts with the Services in any manner.</>,
    ]} />

    <H2>2. Eligibility and Service Scope</H2>
    <P><strong>2.1 Eligibility</strong></P>
    <P>
      The Services are designed and made available for users aged 13 and above. You must be at least
      13 years of age to use the services on your own or otherwise have the consent of your parent or
      legal guardian where such consent is required by applicable law. If you are a parent or legal
      guardian and believe that your child has used the Services in a way that is not permitted by
      applicable law or these Terms, please contact us at <Email addr={SUPPORT_EMAIL} />.
    </P>
    <P><strong>2.2 Service Scope</strong></P>
    <P>We provide users with the following services:</P>
    <Ul items={[
      'Games, features, levels, events, and gameplay-related content;',
      'Play-to-earn cryptocurrency rewards through the Minipay platform;',
      'Customer support services;',
      'In-game events, promotions, campaigns, or contests, which may be subject to separate rules;',
      'Other services we make available from time to time.',
    ]} />
    <P>
      Some services are provided free of charge. Other services or features may require payment or
      interaction with the Minipay platform. The availability of certain services may vary by country,
      region, platform, device, app version, language, or other factors.
    </P>

    <H2>3. Minipay Platform Integration</H2>
    <P>
      Blokaz is built on and integrated with the Minipay platform. Your use of Blokaz is subject to
      Minipay's Terms of Service and Privacy Policy in addition to these Terms. You are responsible for:
    </P>
    <Ul items={[
      'Maintaining your Minipay account security and credentials',
      'Protecting your cryptocurrency wallet information',
      'Complying with Minipay\'s policies and terms',
      'Understanding cryptocurrency and blockchain risks',
    ]} />

    <H2>4. Cryptocurrency Rewards and Disclaimers</H2>
    <P>
      <strong>IMPORTANT:</strong> Earnings from Blokaz are not guaranteed. Cryptocurrency rewards
      are subject to the following conditions:
    </P>
    <Ul items={[
      'Rewards depend entirely on your gameplay performance and may be subject to verification and anti-fraud measures;',
      'Cracked Studio and Minipay reserve the right to modify, suspend, or terminate reward structures, rates, or mechanics at any time without prior notice;',
      'Cryptocurrency values fluctuate and are subject to market volatility, technological risks, and regulatory changes;',
      'You assume all risks associated with cryptocurrency ownership, storage, and transactions;',
      'Fraudulent activity, cheating, or violation of these Terms may result in forfeiture of all earned rewards.',
    ]} />

    <H2>5. License</H2>
    <P>
      Subject to your agreement and continued compliance with the Terms, upon installing and using
      our Services, we grant you a non-exclusive, non-transferable, non-sublicensable, revocable
      license for your own non-commercial entertainment use. This license does not transfer any
      ownership rights in the Services or any Content to you. All rights not expressly granted to you
      are reserved by us and our licensors. This license will terminate or be suspended if you
      materially breach any provision of these Terms, or upon deletion or removal of the Services
      from your device.
    </P>

    <H2>6. User Account</H2>
    <P><strong>6.1 Access Without an Account</strong></P>
    <P>
      You may be able to access and use certain Services without creating or registering an Account.
      In such cases, your use of the Services may be associated with your device, platform, or other
      technical identifiers rather than a formal Account. Play-to-earn rewards may require Account
      creation on Minipay.
    </P>
    <P><strong>6.2 Third-Party Login (Minipay)</strong></P>
    <P>
      You may access the Services by using your Minipay account or other third-party login methods.
      By doing so, you agree to comply with the relevant third party's terms and policies. We are not
      responsible for any act, omission, outage, suspension, or termination relating to your
      third-party account.
    </P>
    <P><strong>6.3 Account Security</strong></P>
    <P>
      You are responsible for maintaining the confidentiality and security of your Account credentials
      and for all activities that occur through your Account, to the extent permitted by applicable law.
    </P>

    <H2>7. Users' Conduct</H2>
    <P>You agree to use the Services lawfully, fairly, and responsibly. You must not, and must not attempt to:</P>
    <Ul items={[
      'Interfere with, damage, disable, overburden, or disrupt any part of the Services;',
      'Upload, transmit, distribute, or introduce viruses, malware, or other harmful code;',
      'Impersonate any person or entity, or falsely state or misrepresent your affiliation;',
      'Harass, abuse, threaten, bully, defame, discriminate against, or otherwise harm any other person;',
      'Infringe the intellectual property, privacy, publicity, data protection, or other rights of any person or entity;',
      'Exploit bugs, errors, or unintended features for unfair advantage;',
      'Engage in fraudulent behavior, including fraudulent ad interactions, invalid traffic, payment fraud, or reward abuse;',
      'Use bots, scripts, automation, scraping, data mining, or other unauthorized means to access or interact with the Services;',
      'Reverse engineer, decompile, disassemble, modify, or create unauthorized derivative works;',
      'Circumvent security or anti-cheat measures;',
      'Buy, sell, rent, lease, share, transfer, or commercially exploit accounts or in-game advantages except as expressly permitted;',
      'Upload, record, or share unlawful, infringing, misleading, obscene, hateful, sexually explicit, or otherwise objectionable material;',
      'Use the Services in violation of applicable law, regulation, or platform requirements.',
    ]} />

    <H2>8. Intellectual Property Rights</H2>
    <P>
      The Services, including all Content, software, code, design, text, graphics, logos, trademarks,
      gameplay elements, and audiovisual works, are owned by us or our licensors and are protected
      by intellectual property and other applicable laws. Except as expressly permitted in these Terms,
      you may not use, copy, reproduce, distribute, modify, publish, or otherwise exploit any part of
      the Services or Content without our prior written consent.
    </P>

    <H2>9. Personal Data Protection</H2>
    <P>
      We highly value your privacy and take reasonable measures to protect your personal data. Please
      refer to our Privacy Policy for information on how we collect, use, disclose, store, and otherwise
      process your personal data in connection with the Services.
    </P>

    <H2>10. Disclaimer and Limitation of Liability</H2>
    <P><strong>10.1 Disclaimer of Warranties</strong></P>
    <P>
      TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE SERVICES ARE PROVIDED
      ON AN "AS IS" AND "AS AVAILABLE" BASIS, WITHOUT WARRANTIES OF ANY KIND, WHETHER
      EXPRESS, IMPLIED, OR STATUTORY, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY,
      FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. WE DO NOT WARRANT
      THAT THE SERVICES WILL BE UNINTERRUPTED, ERROR-FREE, SECURE, OR FREE OF VIRUSES
      OR OTHER HARMFUL COMPONENTS.
    </P>
    <P><strong>10.2 Limitation of Liability</strong></P>
    <P>
      TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL CRACKED
      STUDIO, ITS AFFILIATES, DIRECTORS, OFFICERS, EMPLOYEES, AGENTS, OR LICENSORS BE
      LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, PUNITIVE, OR EXEMPLARY
      DAMAGES, INCLUDING BUT NOT LIMITED TO DAMAGES FOR LOSS OF PROFITS, GOODWILL,
      DATA, OR CRYPTOCURRENCY VALUE, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF
      OR INABILITY TO USE THE SERVICES.
    </P>

    <H2>11. Suspension and Termination</H2>
    <P>
      You may stop using the Services at any time, for any reason, by uninstalling the application.
      We may suspend, restrict, disable, or terminate all or part of your access to the Services at
      any time if:
    </P>
    <Ul items={[
      'You materially or repeatedly breach these Terms;',
      'We reasonably suspect fraud, abuse, unlawful conduct, or security issues;',
      'We need to protect the Services, other users, third parties, or our legitimate interests; or',
      'We are required to do so by law, court order, or regulation.',
    ]} />
    <P>
      Termination may result in forfeiture of earned cryptocurrency rewards. You may appeal such
      decisions by contacting us at <Email addr={SUPPORT_EMAIL} />.
    </P>

    <H2>12. Governing Law and Dispute Resolution</H2>
    <P>
      These Terms shall be governed by and construed in accordance with the laws of Nigeria. If you
      have any concerns or issues, you can contact us at <Email addr="support@blokaz.minipay" />, and
      we will endeavor to resolve disputes through amicable consultation. If a dispute cannot be
      resolved within 30 days, either party may submit it for arbitration at the Nigerian Institute of
      Chartered Arbitrators ("NICArb") in accordance with the NICArb Administered Arbitration Rules.
      The language of the arbitration shall be English.
    </P>

    <H2>13. General Provisions</H2>
    <Ul items={[
      <><strong>Entire Agreement.</strong> These Terms, together with our Privacy Policy, constitute the entire agreement between you and us regarding the Services.</>,
      <><strong>Severability.</strong> If any provision of these Terms is held to be invalid, the remaining provisions shall remain in full force and effect.</>,
      <><strong>No Waiver.</strong> Our failure to enforce any provision of these Terms shall not constitute a waiver of that provision.</>,
      <><strong>Assignment.</strong> We may assign our rights and obligations under these Terms in connection with a merger, acquisition, or sale of assets.</>,
      <><strong>Language.</strong> These Terms are drafted in English. In the event of any conflict between the English version and any translated version, the English version shall prevail.</>,
      <><strong>Changes to These Terms.</strong> We may update these Terms from time to time. Your continued use of the Services after updates means you accept the updated Terms.</>,
    ]} />

    <H2>14. Contact Us</H2>
    <P>
      If you have any questions about these Terms or wish to exercise any rights under applicable
      law, please contact us at: <Email addr={SUPPORT_EMAIL} />.
    </P>
  </div>
)

/* ── Privacy Policy content ─────────────────────────────────────────────────── */

const PrivacyContent: React.FC = () => (
  <div>
    <H2>1. Introduction</H2>
    <P>
      Blokaz ("we," "our," or "us") respects your privacy. This Privacy Policy explains how we
      handle your information when you use our Service on the Minipay platform.
    </P>

    <Rule />

    <H2>2. Minimal Data Collection</H2>
    <P>Blokaz does <strong>NOT</strong> collect personal data directly from you. Our data collection is minimal and limited to:</P>
    <Ul items={[
      'Gameplay Statistics: Your game scores, achievements, level progress, and gameplay duration',
      'Device Information: Anonymous device type, operating system, and app version for technical optimization',
    ]} />

    <H2>3. Minipay Integration and Data Sharing</H2>
    <P>
      Your personal information (email, wallet address, financial data) is managed exclusively by
      Minipay. When you use Blokaz, Minipay shares your verified user ID with us to:
    </P>
    <Ul items={[
      'Link your gameplay achievements to your Minipay wallet for reward distribution',
      'Prevent fraud and duplicate accounts',
      'Comply with applicable laws and regulations',
    ]} />

    <H2>4. Cryptocurrency Wallet Information</H2>
    <P>
      We do not store your private keys, seed phrases, or sensitive wallet credentials. Your wallet
      is secured on the Minipay platform and remains under your control. We only access your wallet
      address for reward distribution purposes.
    </P>

    <H2>5. Data Security</H2>
    <P>
      We implement industry-standard security measures including encryption, firewalls, and secure
      authentication to protect your data. However, no transmission over the internet is completely
      secure. You are responsible for maintaining the confidentiality of your Minipay credentials.
    </P>

    <H2>6. Your Rights</H2>
    <P>You have the right to:</P>
    <Ul items={[
      'Access your gameplay data upon request',
      'Request deletion of your account and associated gameplay data',
      'Opt-out of non-essential data collection (where applicable)',
    ]} />

    <H2>7. Third-Party Links</H2>
    <P>
      Blokaz may contain links to third-party websites. We are not responsible for their privacy
      practices. Please review their Privacy Policies separately.
    </P>

    <H2>8. International Compliance</H2>
    <P>
      Blokaz is available globally and complies with data protection regulations in all jurisdictions
      where it operates, including GDPR for EU users. Users retain all rights granted under applicable
      local laws.
    </P>

    <H2>9. Changes to This Privacy Policy</H2>
    <P>
      We may update this Privacy Policy periodically. Your continued use of Blokaz constitutes
      acceptance of changes.
    </P>

    <Rule />
    <P>For privacy concerns, contact <Email addr={SUPPORT_EMAIL} />.</P>
  </div>
)

/* ── About card ─────────────────────────────────────────────────────────────── */

const AboutBody: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="flex flex-col items-center gap-6 px-6 py-8">
    <div
      className="w-full max-w-[280px] border-4 border-ink p-4"
      style={{ background: 'var(--ink)', boxShadow: '6px 6px 0 var(--shadow)' }}
    >
      <img
        src="/crackedstudioslogo.webp"
        alt="Cracked Studios"
        className="block h-auto w-full"
        width={349}
        height={106}
      />
    </div>

    <div className="w-full max-w-[340px] text-center">
      <p className="font-body text-[13px] leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
        Blokaz is built by{' '}
        <span className="font-bold" style={{ color: 'var(--ink)' }}>Cracked Studios</span>,
        an independent game studio crafting on-chain experiences on the Celo blockchain.
      </p>
    </div>

    <div className="w-full max-w-[340px]" style={{ height: 2, background: 'var(--rule)' }} />

    <div className="flex w-full max-w-[340px] flex-col gap-3">
      <a
        href={ABOUT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="brutal-btn flex w-full items-center justify-center gap-2 border-4 border-ink py-4 font-display text-[12px] uppercase tracking-[0.15em] shadow-[5px_5px_0_var(--shadow)] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
        style={{ background: 'var(--accent-yellow)', color: 'var(--ink-fixed)' }}
      >
        <BrutalIcon name="play" size={14} strokeWidth={2.5} />
        VISIT CRACKEDSTUDIOS.XYZ
      </a>

      <button
        onClick={onClose}
        className="w-full border-[3px] border-ink py-3 font-display text-[11px] uppercase tracking-[0.12em]"
        style={{ background: 'var(--paper-2)', color: 'var(--ink-soft)' }}
      >
        CLOSE
      </button>
    </div>
  </div>
)

export default LegalModal

import React, { useEffect, useState } from 'react';
import { Container, Segment } from 'semantic-ui-react';
import { getFooterHTML } from '../helpers';

const Footer = () => {
  const [footer, setFooter] = useState(getFooterHTML());
  let remainCheckTimes = 5;

  const loadFooter = () => {
    let footer_html = localStorage.getItem('footer_html');
    if (footer_html) {
      setFooter(footer_html);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      if (remainCheckTimes <= 0) {
        clearInterval(timer);
        return;
      }
      remainCheckTimes--;
      loadFooter();
    }, 200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Segment vertical style={{ borderTop: '1px solid rgba(99,102,241,0.08)' }}>
      <Container textAlign='center' style={{ color: '#64748b' }}>
        {footer ? (
          <div
            className='custom-footer'
            dangerouslySetInnerHTML={{ __html: footer }}
          ></div>
        ) : (
          <div className='custom-footer' style={{ fontSize: '0.95em' }}>
            <span style={{
              fontFamily: "'Poppins', sans-serif",
              fontWeight: 600,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              LiteNova
            </span>
            {' '}&mdash; 智能 API 中转平台 | © 2026 LiteNova
          </div>
        )}
      </Container>
    </Segment>
  );
};

export default Footer;

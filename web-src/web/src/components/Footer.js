import React, { useEffect, useState } from 'react';
import { Container, Segment } from 'semantic-ui-react';
import { getFooterHTML } from '../helpers';

const Footer = () => {
  const [footer, setFooter] = useState(getFooterHTML());

  useEffect(() => {
    // Check once after status loads
    const timer = setTimeout(() => {
      const html = localStorage.getItem('footer_html');
      if (html) setFooter(html);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Segment vertical style={{
      borderTop: '1px solid rgba(99,102,241,0.08)',
      padding: '16px 0',
      marginTop: 0,
    }}>
      <Container textAlign='center' style={{ color: '#94a3b8', fontSize: 13 }}>
        {footer ? (
          <div className='custom-footer' dangerouslySetInnerHTML={{ __html: footer }} />
        ) : (
          <div>
            <span style={{
              fontFamily: "'Poppins', sans-serif",
              fontWeight: 600,
              color: '#6366f1',
            }}>
              LiteNova
            </span>
            {' '}&mdash; 智能 API 中转平台
          </div>
        )}
      </Container>
    </Segment>
  );
};

export default Footer;

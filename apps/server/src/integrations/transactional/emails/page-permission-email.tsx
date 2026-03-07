import { Section, Text, Button } from '@react-email/components';
import * as React from 'react';
import { button, content, paragraph } from '../css/styles';
import { MailBody } from '../partials/partials';

interface Props {
  actorName: string;
  pageTitle: string;
  pageUrl: string;
  role: 'reader' | 'writer';
}

export const PagePermissionEmail = ({
  actorName,
  pageTitle,
  pageUrl,
  role,
}: Props) => {
  const accessText = role === 'writer' ? 'edit access' : 'view access';

  return (
    <MailBody>
      <Section style={content}>
        <Text style={paragraph}>Hi there,</Text>
        <Text style={paragraph}>
          <strong>{actorName}</strong> gave you <strong>{accessText}</strong> to{' '}
          <strong>{pageTitle}</strong>.
        </Text>
      </Section>
      <Section
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          paddingLeft: '15px',
          paddingBottom: '15px',
        }}
      >
        <Button href={pageUrl} style={button}>
          View
        </Button>
      </Section>
    </MailBody>
  );
};

export default PagePermissionEmail;

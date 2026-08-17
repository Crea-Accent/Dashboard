// @ts-nocheck
import { Body, Head, Heading, Html, Img, Link, Text } from '@react-email/components';
import * as React from 'react';

const Spacer = ({ height }: { height: number }) => (
	<table width="100%" border={0} cellPadding={0} cellSpacing={0} role="presentation" align="center" bgcolor="#F9F7F3">
		<tr>
			<td height={height} style={{ fontSize: 0, lineHeight: 0 }} bgcolor="#F9F7F3">
				&nbsp;
			</td>
		</tr>
	</table>
);

export default function EventInviteEmail({ event, contact, baseUrl, bannerUrl, ribbonUrl }: { event: any; contact: any; baseUrl: string; bannerUrl?: string; ribbonUrl?: string }) {
	const days = ['ZONDAG', 'MAANDAG', 'DINSDAG', 'WOENSDAG', 'DONDERDAG', 'VRIJDAG', 'ZATERDAG'];
	const months = ['Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni', 'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'];

	let dateObj = new Date(event?.date);
	let isValidDate = !isNaN(dateObj.getTime());

	return (
		<Html lang="nl">
			<Head>
				<link href="https://fonts.googleapis.com/css2?family=Neuton:wght@400;700;800&display=swap" rel="stylesheet" />
				<style>{`
          body { background-color: #F9F7F3 !important; margin: 0; padding: 0; }
          table { border-collapse: collapse; }
        `}</style>
			</Head>
			<Body style={styles.body}>
				<table width="100%" border={0} cellPadding={0} cellSpacing={0} role="presentation" bgcolor="#F9F7F3" style={{ backgroundColor: '#F9F7F3' }}>
					<tr>
						<td align="center" valign="top" bgcolor="#F9F7F3" style={{ padding: '40px 10px' }}>
							<table width="100%" border={0} cellPadding={0} cellSpacing={0} role="presentation" align="center" bgcolor="#F9F7F3" style={{ maxWidth: '800px', margin: '0 auto' }}>
								<tr>
									<td align="center" bgcolor="#F9F7F3">
										<Heading style={styles.title}>{event?.name}</Heading>

										<Spacer height={50} />

										<table
											width="100%"
											border={0}
											cellPadding={0}
											cellSpacing={0}
											role="presentation"
											align="center"
											bgcolor="#F9F7F3"
											style={{ maxWidth: '550px', margin: '0 auto' }}
										>
											<tr>
												<td align="center" bgcolor="#F9F7F3">
													{event?.description ? (
														event.description.split('\n').map((p: string, i: number) => (
															<Text key={i} style={styles.text}>
																{p}
															</Text>
														))
													) : (
														<>
															<Text style={styles.text}>
																Wij nodigen u graag persoonlijk uit voor
																<br />
																een exclusieve netwerk- en inspiratieavond in onze showroom.
															</Text>
															<Text style={styles.text}>
																Tijdens deze avond delen we trends en inzichten in high-end interieurprojecten,
																<br />
																van ontwerp tot uitvoering, en bieden we de mogelijkheid om te netwerken
																<br />
																met andere bouwprofessionals.
															</Text>
														</>
													)}
												</td>
											</tr>
										</table>

										<Spacer height={50} />

										<table
											width="100%"
											border={0}
											cellPadding={0}
											cellSpacing={0}
											role="presentation"
											align="center"
											bgcolor="#F9F7F3"
											style={{ maxWidth: '400px', margin: '0 auto' }}
										>
											<tr>
												<td width="33%" align="right" valign="middle" bgcolor="#F9F7F3" style={styles.dateText}>
													{isValidDate ? days[dateObj.getDay()] : ''}
												</td>
												<td width="34%" align="center" valign="middle" bgcolor="#F9F7F3" style={{ padding: '0 20px' }}>
													<Text style={styles.dateMonth}>{isValidDate ? months[dateObj.getMonth()] : ''}</Text>
													<div style={styles.dateDayBox}>{isValidDate ? String(dateObj.getDate()).padStart(2, '0') : ''}</div>
													<Text style={styles.dateYear}>{isValidDate ? dateObj.getFullYear() : ''}</Text>
												</td>
												<td width="33%" align="left" valign="middle" bgcolor="#F9F7F3" style={styles.dateText}>
													{event?.time || `${event?.welcomeTime || ''} ${event?.welcomeTime && event?.endTime ? '-' : ''} ${event?.endTime || ''}`}
												</td>
											</tr>
										</table>

										<Spacer height={50} />

										<table
											width="100%"
											border={0}
											cellPadding={0}
											cellSpacing={0}
											role="presentation"
											align="center"
											bgcolor="#F9F7F3"
											style={{ maxWidth: '800px', margin: '0 auto' }}
										>
											<tr>
												<td width="55%" valign="middle" align="left" bgcolor="#F9F7F3" style={{ paddingRight: '40px' }}>
													<Img src={bannerUrl || `${baseUrl}/banner.png`} alt="Event Banner" width="440" style={styles.imageFull} />
												</td>
												<td width="45%" valign="middle" align="left" bgcolor="#F9F7F3">
													<Text style={styles.programTitle}>PROGRAMMA VAN DE AVOND</Text>
													<table
														border={0}
														cellPadding={0}
														cellSpacing={0}
														role="presentation"
														style={{
															fontSize: '15px',
															lineHeight: '1.8',
															color: '#111111',
															width: '100%',
														}}
													>
														<tbody>
															{event?.welcomeTime && (
																<tr>
																	<td style={styles.tdLeft} bgcolor="#F9F7F3">
																		{event.welcomeTime}
																	</td>
																	<td style={styles.tdRight} bgcolor="#F9F7F3">
																		ontvangst
																	</td>
																</tr>
															)}
															{event?.startTime && (
																<tr>
																	<td style={styles.tdLeft} bgcolor="#F9F7F3">
																		{event.startTime}
																	</td>
																	<td style={styles.tdRight} bgcolor="#F9F7F3">
																		welkomstwoord
																	</td>
																</tr>
															)}
															{event?.endTime && (
																<tr>
																	<td style={styles.tdLeft} bgcolor="#F9F7F3">
																		{event.endTime}
																	</td>
																	<td style={styles.tdRight} bgcolor="#F9F7F3">
																		einde
																	</td>
																</tr>
															)}
														</tbody>
													</table>
												</td>
											</tr>
										</table>

										<Spacer height={50} />

										<table
											width="100%"
											border={0}
											cellPadding={0}
											cellSpacing={0}
											role="presentation"
											align="center"
											bgcolor="#F9F7F3"
											style={{ maxWidth: '550px', margin: '0 auto' }}
										>
											<tr>
												<td align="center" bgcolor="#F9F7F3">
													<Text style={styles.text}>
														Het aantal plaatsen is beperkt.
														<br />
														We reserveren graag een plekje voor u!
													</Text>
													<Text style={styles.text}>
														Denk jij nog aan iemand die onze showroom ook zeker eens gezien moet hebben?
														<br />
														Neem dan gerust 1 of 2 bouw-gerelateerde contacten mee!
														<br />
														Gelieve ook hun aanwezigheid te bevestigen.
													</Text>
													<Text style={styles.text}>Bevestig uw aanwezigheid uiterlijk via deze link:</Text>

													<Spacer height={20} />

													<table border={0} cellPadding={0} cellSpacing={0} role="presentation" align="center" style={{ margin: '0 auto' }}>
														<tr>
															<td
																align="center"
																bgcolor="#899B73"
																style={{
																	borderRadius: '999px',
																	padding: '16px 40px',
																}}
															>
																<Link href={`${baseUrl}/invite/${event?.id}/${contact?.id}`} style={styles.primaryButton}>
																	BEVESTIG AANWEZIGHEID
																</Link>
															</td>
														</tr>
													</table>
												</td>
											</tr>
										</table>

										<Spacer height={50} />

										<table
											width="100%"
											border={0}
											cellPadding={0}
											cellSpacing={0}
											role="presentation"
											align="center"
											bgcolor="#F9F7F3"
											style={{ maxWidth: '800px', margin: '0 auto' }}
										>
											<tr>
												<td align="center" bgcolor="#F9F7F3">
													<Img src={ribbonUrl || `${baseUrl}/ribbon.png`} alt="Inspiration Ribbon" width="800" style={styles.imageFull} />
												</td>
											</tr>
										</table>

										<Spacer height={50} />

										<table
											width="100%"
											border={0}
											cellPadding={0}
											cellSpacing={0}
											role="presentation"
											align="center"
											bgcolor="#F9F7F3"
											style={{ maxWidth: '550px', margin: '0 auto' }}
										>
											<tr>
												<td align="center" bgcolor="#F9F7F3">
													<Text style={styles.text}>
														Wij voorzien een hapje en een drankje.
														<br />
														Maak daarnaast kennis met andere interessante contacten uit de sector!
													</Text>
													<Img src={`${baseUrl}/logo.png`} alt="Crea Accent Logo" width="200" style={styles.logo} />
												</td>
											</tr>
										</table>

										<Spacer height={50} />

										<table
											width="100%"
											border={0}
											cellPadding={0}
											cellSpacing={0}
											role="presentation"
											align="center"
											bgcolor="#F9F7F3"
											style={{ maxWidth: '550px', margin: '0 auto' }}
										>
											<tr>
												<td align="center" bgcolor="#F9F7F3">
													<Text style={styles.programTitle}>WAAR PARKEREN ?</Text>
													<Text style={styles.text}>
														{event?.location || 'Er is voldoende parkeerplek op het Lodewijk De Vocht plein; dit is op 200m stappen van onze showroom.'}
													</Text>

													<Spacer height={20} />

													<table border={0} cellPadding={0} cellSpacing={0} role="presentation" align="center" style={{ margin: '0 auto' }}>
														<tr>
															<td
																align="center"
																bgcolor="#111111"
																style={{
																	borderRadius: '999px',
																	padding: '14px 30px',
																}}
															>
																<Link
																	href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event?.location || 'Lodewijk De Vocht plein')}`}
																	style={styles.secondaryButton}
																>
																	📍 ROUTEBESCHRIJVING
																</Link>
															</td>
														</tr>
													</table>
												</td>
											</tr>
										</table>
									</td>
								</tr>
							</table>

							<table width="100%" border={0} cellPadding={0} cellSpacing={0} role="presentation" align="center" bgcolor="#F9F7F3" style={{ marginTop: '40px' }}>
								<tr>
									<td align="center" bgcolor="#F9F7F3">
										<Link href="https://www.crea-accent.be" style={styles.socialLink}>
											<Img src={`${baseUrl}/website.png`} width="32" height="32" alt="Website" style={styles.socialIcon} />
										</Link>
										<Link href="https://www.instagram.com/crea.accent/" style={styles.socialLink}>
											<Img src={`${baseUrl}/instagram.png`} width="32" height="32" alt="Instagram" style={styles.socialIcon} />
										</Link>
										<Link href="https://www.linkedin.com/company/crea-accent" style={styles.socialLink}>
											<Img src={`${baseUrl}/linkedin.png`} width="32" height="32" alt="LinkedIn" style={styles.socialIcon} />
										</Link>
										<Link href="https://www.facebook.com/Crea.Accent.Verlichting" style={styles.socialLink}>
											<Img src={`${baseUrl}/facebook.png`} width="32" height="32" alt="Facebook" style={styles.socialIcon} />
										</Link>
									</td>
								</tr>
							</table>
						</td>
					</tr>
				</table>
			</Body>
		</Html>
	);
}

const styles = {
	body: {
		backgroundColor: '#F9F7F3',
		fontFamily: "'Neuton', Georgia, serif",
		color: '#111111',
		WebkitFontSmoothing: 'antialiased',
		margin: '0 auto',
	} as React.CSSProperties,
	title: {
		fontFamily: "'Helvetica Neue', Arial, sans-serif",
		fontSize: '42px',
		fontWeight: '400',
		letterSpacing: '3px',
		textTransform: 'uppercase' as const,
		margin: '0',
		lineHeight: '1.2',
	},
	text: {
		fontSize: '15px',
		lineHeight: '1.8',
		margin: '0 0 10px 0',
		color: '#111111',
		textAlign: 'center' as const,
	},
	dateText: {
		fontFamily: "'Neuton', Georgia, serif",
		fontSize: '16px',
		letterSpacing: '1px',
		color: '#111111',
	},
	dateMonth: {
		fontSize: '15px',
		marginBottom: '8px',
		color: '#111111',
		margin: '0',
	},
	dateDayBox: {
		fontSize: '54px',
		color: '#899B73',
		lineHeight: '1',
		padding: '5px 0',
		borderLeft: '1px solid #899B73',
		borderRight: '1px solid #899B73',
		fontFamily: "'Helvetica Neue', Arial, sans-serif",
		margin: '0',
	},
	dateYear: {
		fontSize: '15px',
		marginTop: '8px',
		color: '#111111',
		margin: '0',
	},
	imageFull: {
		width: '100%',
		height: 'auto',
		display: 'block',
	},
	programTitle: {
		fontFamily: "'Helvetica Neue', Arial, sans-serif",
		fontSize: '14px',
		fontWeight: 'bold',
		letterSpacing: '1px',
		textTransform: 'uppercase' as const,
		margin: '0 0 20px 0',
		color: '#111111',
		textAlign: 'left' as const,
	},
	tdLeft: {
		width: '70px',
		verticalAlign: 'top',
		paddingBottom: '5px',
	},
	tdRight: {
		verticalAlign: 'top',
		paddingBottom: '5px',
	},
	primaryButton: {
		color: '#ffffff',
		textDecoration: 'none',
		fontSize: '16px',
		fontWeight: '700',
		letterSpacing: '.6px',
		fontFamily: "'Helvetica Neue', Arial, sans-serif",
		display: 'inline-block',
	},
	logo: {
		maxWidth: '200px',
		height: 'auto',
		display: 'inline-block',
	},
	secondaryButton: {
		color: '#ffffff',
		textDecoration: 'none',
		fontSize: '14px',
		fontWeight: '700',
		letterSpacing: '.6px',
		fontFamily: "'Helvetica Neue', Arial, sans-serif",
		display: 'inline-block',
	},
	socialLink: {
		display: 'inline-block',
		margin: '0 8px',
	},
	socialIcon: {
		display: 'block',
		width: '32px',
		height: '32px',
	},
};

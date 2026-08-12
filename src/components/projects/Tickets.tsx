/** @format */
'use client';

import { CheckCircle2, ChevronDown, Circle, Clock, Plus, Download, Ticket as TicketIcon, Loader2, FileText as FileIcon, GripVertical } from 'lucide-react';
import { useEffect, useState } from 'react';

import { DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import Button from '../ui/Button';
import Card from '../ui/Card';
import CompleteTaskModal from './tickets/CompleteTaskModal';
import EmptyState from '../ui/EmptyState';
import File from '../files/File';
import Loading from '../ui/Loading';
import TicketModal from './tickets/TicketModal';
import { usePermissions } from '@/providers/PermissionsProvider';
import { useSession } from 'next-auth/react';

type POI = {
	id: string;
	description: string;
	technician: string;
	importance: number;
	requiresPicture?: boolean;
	state: 'unfinished' | 'finished';
	imagePath?: string;
	finishedImagePath?: string;
	completedBy?: string;
};

type Ticket = {
	id: string;
	name?: string;
	createdAt: string;
	openedBy: string;
	pois: POI[];
};

export default function Tickets({ client }: { client: string }) {
	const { has } = usePermissions();
	const { data: session } = useSession();

	const [tickets, setTickets] = useState<Ticket[]>([]);
	const [expandedTickets, setExpandedTickets] = useState<Record<string, boolean>>({});
	const [loading, setLoading] = useState(true);
	const [modalOpen, setModalOpen] = useState(false);
	const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
	const [poiToComplete, setPoiToComplete] = useState<{ ticketId: string; poiId: string; requiresPicture?: boolean } | null>(null);
	const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
	const [users, setUsers] = useState<any[]>([]);

	const isAllowed = has('tasks.write');
	const canView = has('tasks.read') || has('tasks.write');
	const currentUsername = session?.user?.name || '';

	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {
				distance: 8,
			},
		}),
		useSensor(TouchSensor, {
			activationConstraint: {
				delay: 200,
				tolerance: 8,
			},
		}),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		})
	);

	const handleDragEnd = async (event: any, ticketId: string) => {
		const { active, over } = event;

		if (over && active.id !== over.id) {
			const ticketIndex = tickets.findIndex((t) => t.id === ticketId);
			if (ticketIndex === -1) return;

			const ticket = tickets[ticketIndex];
			const oldIndex = ticket.pois.findIndex((p) => p.id === active.id);
			const newIndex = ticket.pois.findIndex((p) => p.id === over.id);

			const newPOIs = arrayMove(ticket.pois, oldIndex, newIndex).map((p, i) => ({ ...p, importance: i + 1 }));

			const updatedTickets = [...tickets];
			updatedTickets[ticketIndex] = { ...ticket, pois: newPOIs };
			setTickets(updatedTickets);

			await fetch('/api/projects/tickets', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					client,
					ticketId,
					updates: { pois: newPOIs },
				}),
			});
		}
	};

	const load = async () => {
		try {
			setLoading(true);
			const [ticketsRes, usersRes] = await Promise.all([
				fetch(`/api/projects/tickets?client=${encodeURIComponent(client)}`),
				fetch('/api/users'),
			]);

			if (ticketsRes.ok) {
				const data = await ticketsRes.json();
				const loaded = data.tickets || [];
				setTickets(loaded);

				setExpandedTickets((curr) => {
					const next = { ...curr };
					loaded.forEach((t: Ticket) => {
						if (next[t.id] === undefined) {
							const isCompleted = t.pois.length > 0 && t.pois.every((p) => p.state === 'finished');
							next[t.id] = !isCompleted;
						}
					});
					return next;
				});
			}

			if (usersRes.ok) {
				const data = await usersRes.json();
				setUsers(data.users || []);
			}
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		load();
	}, [client]);

	const markPOIDone = async (ticketId: string, poiId: string, finishedImagePath?: string, completedBy?: string, proofDescription?: string) => {
		const ticketIndex = tickets.findIndex((t) => t.id === ticketId);
		if (ticketIndex === -1) return;

		const ticket = tickets[ticketIndex];
		const updatedPOIs = ticket.pois.map((poi) => (poi.id === poiId ? { ...poi, state: 'finished' as const, finishedImagePath, completedBy, proofDescription } : poi));
		const isCompleted = updatedPOIs.length > 0 && updatedPOIs.every((p) => p.state === 'finished');

		// Optimistic update
		const updatedTickets = [...tickets];
		updatedTickets[ticketIndex] = { ...ticket, pois: updatedPOIs };
		setTickets(updatedTickets);

		if (isCompleted) {
			setExpandedTickets((curr) => ({ ...curr, [ticketId]: false }));
		}

		await fetch('/api/projects/tickets', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				client,
				ticketId,
				updates: { pois: updatedPOIs },
			}),
		});

		await load();
	};

	const getBase64Image = async (url: string): Promise<{ data: string; width: number; height: number } | null> => {
		try {
			const res = await fetch(url);
			if (!res.ok) return null;
			const blob = await res.blob();
			const objectUrl = URL.createObjectURL(blob);
			const isPng = blob.type === 'image/png' || url.toLowerCase().endsWith('.png');
			
			return new Promise((resolve) => {
				const img = new Image();
				img.crossOrigin = "Anonymous";
				img.onload = () => {
					const canvas = document.createElement('canvas');
					canvas.width = img.naturalWidth;
					canvas.height = img.naturalHeight;
					const ctx = canvas.getContext('2d');
					if (ctx) {
						ctx.drawImage(img, 0, 0);
						resolve({ data: canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', 0.9), width: img.naturalWidth, height: img.naturalHeight });
					} else {
						resolve({ data: img.src, width: img.naturalWidth, height: img.naturalHeight });
					}
					URL.revokeObjectURL(objectUrl);
				};
				img.onerror = () => {
					URL.revokeObjectURL(objectUrl);
					resolve(null);
				};
				img.src = objectUrl;
			});
		} catch (e) {
			console.error('Failed to load image', e);
			return null;
		}
	};

	const generatePDF = async (ticket: any) => {
		setGeneratingPdf(ticket.id);
		try {
			const doc = new jsPDF();
			
			// Brand Colors
			const primaryColor = [164, 183, 149];
			const darkText = [40, 40, 40];
			const lightText = [120, 120, 120];

			// Header Accent Bar
			doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
			doc.rect(0, 0, doc.internal.pageSize.getWidth(), 6, 'F');

			const logo = await getBase64Image('/logo.png');
			let startY = 25;

			if (logo) {
				const imgWidth = 40;
				const imgHeight = (imgWidth * logo.height) / logo.width;
				doc.addImage(logo.data, 'PNG', 14, 14, imgWidth, imgHeight);
				startY = 14 + imgHeight + 12;
			}
			
			const pageWidth = doc.internal.pageSize.getWidth();
			
			// Title & Meta (Right Aligned Meta)
			doc.setFontSize(24);
			doc.setTextColor(darkText[0], darkText[1], darkText[2]);
			doc.setFont('helvetica', 'bold');
			doc.text(`${ticket.name || 'Ticket Summary'}`, 14, startY);
			
			doc.setFontSize(10);
			doc.setFont('helvetica', 'normal');
			doc.setTextColor(lightText[0], lightText[1], lightText[2]);
			
			doc.text(`Project: ${client}`, pageWidth - 14, startY - 8, { align: 'right' });
			doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - 14, startY - 3, { align: 'right' });
			doc.text(`Opened by: ${ticket.openedBy}`, pageWidth - 14, startY + 2, { align: 'right' });

			// Divider line
			doc.setDrawColor(230, 230, 230);
			doc.setLineWidth(0.5);
			doc.line(14, startY + 8, pageWidth - 14, startY + 8);

			let currentY = startY + 16;

			const renderTable = (pois: any[], title: string) => {
				if (pois.length === 0) return;
				
				if (currentY > 260) {
					doc.addPage();
					doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
					doc.rect(0, 0, pageWidth, 6, 'F');
					currentY = 20;
				}

				doc.setFontSize(14);
				doc.setFont('helvetica', 'bold');
				doc.setTextColor(darkText[0], darkText[1], darkText[2]);
				doc.text(title, 14, currentY);
				currentY += 4;

				const tableData = pois.map((poi: any) => [
					(ticket.pois.findIndex((p: any) => p.id === poi.id) + 1).toString(),
					poi.description,
					poi.state === 'finished' ? poi.completedBy || poi.technician || 'Unknown' : poi.technician || 'Unassigned',
					poi.proofDescription || '-'
				]);

				autoTable(doc, {
					startY: currentY,
					head: [['#', 'Description', title === 'Completed Tasks' ? 'Completed By' : 'Assignee', 'Notes']],
					body: tableData,
					theme: 'plain',
					headStyles: { 
						fillColor: [248, 250, 248], 
						textColor: [80, 80, 80],
						fontStyle: 'bold',
						fontSize: 9,
						cellPadding: 6,
						lineColor: [230, 230, 230],
						lineWidth: { bottom: 1, top: 1 }
					},
					bodyStyles: {
						textColor: [60, 60, 60],
						fontSize: 9,
						cellPadding: 6,
						lineColor: [240, 240, 240],
						lineWidth: { bottom: 0.5 },
						valign: 'top'
					},
					alternateRowStyles: {
						fillColor: [252, 252, 252]
					},
					columnStyles: {
						0: { cellWidth: 15 },
						1: { cellWidth: 70 },
						2: { cellWidth: 50 },
						3: { cellWidth: 47 }
					}
				});

				currentY = (doc as any).lastAutoTable.finalY + 12;
			};

			const unfinishedPOIs = ticket.pois.filter((p: any) => p.state !== 'finished');
			const finishedPOIs = ticket.pois.filter((p: any) => p.state === 'finished');

			renderTable(unfinishedPOIs, 'Pending Tasks');
			renderTable(finishedPOIs, 'Completed Tasks');

			const poisWithImages = ticket.pois.filter((poi: any) => poi.imagePath || poi.finishedImagePath);
			
			if (poisWithImages.length > 0) {
				doc.addPage();
				
				// Header Accent Bar for new pages
				doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
				doc.rect(0, 0, pageWidth, 6, 'F');
				
				doc.setFontSize(18);
				doc.setFont('helvetica', 'bold');
				doc.setTextColor(darkText[0], darkText[1], darkText[2]);
				doc.text("Photographic Evidence", 14, 24);
				
				doc.setDrawColor(230, 230, 230);
				doc.setLineWidth(0.5);
				doc.line(14, 30, pageWidth - 14, 30);
				
				let currY = 40;

				for (let i = 0; i < poisWithImages.length; i++) {
					const poi = poisWithImages[i];
					doc.setFontSize(12);
					doc.setFont('helvetica', 'bold');
					doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
					doc.text(`Task #${ticket.pois.findIndex((p: any) => p.id === poi.id) + 1}`, 14, currY);
					
					doc.setFontSize(11);
					doc.setFont('helvetica', 'normal');
					doc.setTextColor(60, 60, 60);
					
					// Word wrap description to prevent overflowing
					const splitDescription = doc.splitTextToSize(`${poi.description}`, pageWidth - 45);
					doc.text(splitDescription, 35, currY);

					currY += (splitDescription.length * 5) + 6;

					let beforeImg, afterImg;
					if (poi.imagePath) {
						beforeImg = await getBase64Image(`/api/files/render?path=${encodeURIComponent(poi.imagePath)}`);
					}
					if (poi.finishedImagePath) {
						afterImg = await getBase64Image(`/api/files/render?path=${encodeURIComponent(poi.finishedImagePath)}`);
					}

					const maxImgHeight = 65;
					const maxImgWidth = 80;

					let currentAddedHeight = 0;

					if (beforeImg) {
						let w = maxImgWidth;
						let h = (w * beforeImg.height) / beforeImg.width;
						if (h > maxImgHeight) {
							h = maxImgHeight;
							w = (h * beforeImg.width) / beforeImg.height;
						}
						
						if (currY + h > 270) {
							doc.addPage();
							doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
							doc.rect(0, 0, pageWidth, 6, 'F');
							currY = 20;
						}

						doc.setFontSize(8);
						doc.setFont('helvetica', 'bold');
						const bText = "BEFORE";
						const bWidth = doc.getTextWidth(bText) + 6;
						doc.setFillColor(140, 145, 150);
						const badgeX = 14 + (w / 2) - (bWidth / 2);
						doc.roundedRect(badgeX, currY - 4, bWidth, 5.5, 1, 1, 'F');
						doc.setTextColor(255, 255, 255);
						doc.text(bText, badgeX + 3, currY);
						
						// Draw border
						doc.setDrawColor(220, 220, 220);
						doc.setLineWidth(0.5);
						doc.rect(14, currY + 4, w, h);
						doc.addImage(beforeImg.data, 'JPEG', 14, currY + 4, w, h);
						currentAddedHeight = Math.max(currentAddedHeight, h);
					}

					if (afterImg) {
						let w = maxImgWidth;
						let h = (w * afterImg.height) / afterImg.width;
						if (h > maxImgHeight) {
							h = maxImgHeight;
							w = (h * afterImg.width) / afterImg.height;
						}
						
						if (currY + h > 270) {
							if (!beforeImg) {
								doc.addPage();
								doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
								doc.rect(0, 0, pageWidth, 6, 'F');
								currY = 20;
							}
						}
						doc.setFontSize(8);
						doc.setFont('helvetica', 'bold');
						const aText = "AFTER";
						const aWidth = doc.getTextWidth(aText) + 6;
						doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
						const badgeX = 105 + (w / 2) - (aWidth / 2);
						doc.roundedRect(badgeX, currY - 4, aWidth, 5.5, 1, 1, 'F');
						doc.setTextColor(255, 255, 255);
						doc.text(aText, badgeX + 3, currY);
						
						// Draw border
						doc.setDrawColor(220, 220, 220);
						doc.setLineWidth(0.5);
						doc.rect(105, currY + 4, w, h);
						doc.addImage(afterImg.data, 'JPEG', 105, currY + 4, w, h);
						currentAddedHeight = Math.max(currentAddedHeight, h);
					}

					currY += currentAddedHeight + 16; 
					
					if (currY > 250 && i < poisWithImages.length - 1) {
						doc.addPage();
						doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
						doc.rect(0, 0, pageWidth, 6, 'F');
						currY = 20;
					}
				}
			}

			// Add page numbers
			const pageCount = (doc as any).internal.getNumberOfPages();
			for (let i = 1; i <= pageCount; i++) {
				doc.setPage(i);
				doc.setFontSize(9);
				doc.setFont('helvetica', 'normal');
				doc.setTextColor(150);
				doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.getWidth() - 14, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
			}

			doc.save(`${ticket.name || 'Summary'}_${new Date().toISOString().split('T')[0]}.pdf`);
		} catch (error) {
			console.error("Failed to generate PDF", error);
		} finally {
			setGeneratingPdf(null);
		}
	};

	const generateProjectPDF = async () => {
		setGeneratingPdf('project');
		try {
			const doc = new jsPDF();
			
			// Brand Colors
			const primaryColor = [164, 183, 149];
			const darkText = [40, 40, 40];
			const lightText = [120, 120, 120];

			// Header Accent Bar
			doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
			doc.rect(0, 0, doc.internal.pageSize.getWidth(), 6, 'F');

			const logo = await getBase64Image('/logo.png');
			let startY = 25;

			if (logo) {
				const imgWidth = 40;
				const imgHeight = (imgWidth * logo.height) / logo.width;
				doc.addImage(logo.data, 'PNG', 14, 14, imgWidth, imgHeight);
				startY = 14 + imgHeight + 12;
			}
			
			const pageWidth = doc.internal.pageSize.getWidth();
			
			// Title & Meta (Right Aligned Meta)
			doc.setFontSize(24);
			doc.setTextColor(darkText[0], darkText[1], darkText[2]);
			doc.setFont('helvetica', 'bold');
			doc.text(`Project Summary`, 14, startY);
			
			doc.setFontSize(10);
			doc.setFont('helvetica', 'normal');
			doc.setTextColor(lightText[0], lightText[1], lightText[2]);
			
			doc.text(`Project: ${client}`, pageWidth - 14, startY - 8, { align: 'right' });
			doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - 14, startY - 3, { align: 'right' });
			doc.text(`Total Tickets: ${tickets.length}`, pageWidth - 14, startY + 2, { align: 'right' });

			// Divider line
			doc.setDrawColor(230, 230, 230);
			doc.setLineWidth(0.5);
			doc.line(14, startY + 8, pageWidth - 14, startY + 8);
            
            let currentY = startY + 20;

			for (let tIndex = 0; tIndex < tickets.length; tIndex++) {
                const ticket = tickets[tIndex];
                
                if (tIndex > 0) {
                    doc.addPage();
                    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
                    doc.rect(0, 0, pageWidth, 6, 'F');
                    currentY = 20;
                }

                doc.setFontSize(16);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(darkText[0], darkText[1], darkText[2]);
                doc.text(ticket.name || 'Untitled Ticket', 14, currentY);

                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(lightText[0], lightText[1], lightText[2]);
                doc.text(`Opened by: ${ticket.openedBy || 'Unknown'} - ${new Date(ticket.createdAt).toLocaleDateString()}`, 14, currentY + 6);
                
                currentY += 12;

                const renderTable = (pois: any[], title: string) => {
                    if (pois.length === 0) return;
                    
                    if (currentY > 260) {
                        doc.addPage();
                        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
                        doc.rect(0, 0, pageWidth, 6, 'F');
                        currentY = 20;
                    }

                    doc.setFontSize(14);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(darkText[0], darkText[1], darkText[2]);
                    doc.text(title, 14, currentY);
                    currentY += 4;

                    const tableData = pois.map((poi: any) => [
                        (ticket.pois.findIndex((p: any) => p.id === poi.id) + 1).toString(),
                        poi.description,
                        poi.state === 'finished' ? poi.completedBy || poi.technician || 'Unknown' : poi.technician || 'Unassigned',
                        poi.proofDescription || '-'
                    ]);

                    autoTable(doc, {
                        startY: currentY,
                        head: [['#', 'Description', title === 'Completed Tasks' ? 'Completed By' : 'Assignee', 'Notes']],
                        body: tableData,
                        theme: 'plain',
                        headStyles: { 
                            fillColor: [248, 250, 248], 
                            textColor: [80, 80, 80],
                            fontStyle: 'bold',
                            fontSize: 9,
                            cellPadding: 6,
                            lineColor: [230, 230, 230],
                            lineWidth: { bottom: 1, top: 1 }
                        },
                        bodyStyles: {
                            textColor: [60, 60, 60],
                            fontSize: 9,
                            cellPadding: 6,
                            lineColor: [240, 240, 240],
                            lineWidth: { bottom: 0.5 },
                            valign: 'top'
                        },
                        alternateRowStyles: {
                            fillColor: [252, 252, 252]
                        },
                        columnStyles: {
                            0: { cellWidth: 15 },
                            1: { cellWidth: 70 },
                            2: { cellWidth: 50 },
                            3: { cellWidth: 47 }
                        }
                    });

                    currentY = (doc as any).lastAutoTable.finalY + 12;
                };

                const unfinishedPOIs = ticket.pois.filter((p: any) => p.state !== 'finished');
                const finishedPOIs = ticket.pois.filter((p: any) => p.state === 'finished');

                renderTable(unfinishedPOIs, 'Pending Tasks');
                renderTable(finishedPOIs, 'Completed Tasks');

                const poisWithImages = ticket.pois.filter((poi: any) => poi.imagePath || poi.finishedImagePath);
                
                if (poisWithImages.length > 0) {
                    if (currentY > 230) {
                        doc.addPage();
                        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
                        doc.rect(0, 0, pageWidth, 6, 'F');
                        currentY = 24;
                    } else {
                        currentY += 10;
                    }

                    doc.setFontSize(14);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(darkText[0], darkText[1], darkText[2]);
                    doc.text("Photographic Evidence", 14, currentY);
                    
                    doc.setDrawColor(230, 230, 230);
                    doc.setLineWidth(0.5);
                    doc.line(14, currentY + 4, pageWidth - 14, currentY + 4);
                    
                    currentY += 14;

                    for (let i = 0; i < poisWithImages.length; i++) {
                        const poi = poisWithImages[i];
                        doc.setFontSize(12);
                        doc.setFont('helvetica', 'bold');
                        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
                        doc.text(`Task #${ticket.pois.findIndex((p: any) => p.id === poi.id) + 1}`, 14, currentY);
                        
                        doc.setFontSize(11);
                        doc.setFont('helvetica', 'normal');
                        doc.setTextColor(60, 60, 60);
                        
                        const splitDescription = doc.splitTextToSize(`${poi.description}`, pageWidth - 45);
                        doc.text(splitDescription, 35, currentY);

                        currentY += (splitDescription.length * 5) + 6;

                        let beforeImg, afterImg;
                        if (poi.imagePath) {
                            beforeImg = await getBase64Image(`/api/files/render?path=${encodeURIComponent(poi.imagePath)}`);
                        }
                        if (poi.finishedImagePath) {
                            afterImg = await getBase64Image(`/api/files/render?path=${encodeURIComponent(poi.finishedImagePath)}`);
                        }

                        const maxImgHeight = 65;
                        const maxImgWidth = 80;

                        let currentAddedHeight = 0;

                        if (beforeImg) {
                            let w = maxImgWidth;
                            let h = (w * beforeImg.height) / beforeImg.width;
                            if (h > maxImgHeight) {
                                h = maxImgHeight;
                                w = (h * beforeImg.width) / beforeImg.height;
                            }
                            
                            if (currentY + h > 270) {
                                doc.addPage();
                                doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
                                doc.rect(0, 0, pageWidth, 6, 'F');
                                currentY = 20;
                            }

                            doc.setFontSize(8);
                            doc.setFont('helvetica', 'bold');
                            const bText = "BEFORE";
                            const bWidth = doc.getTextWidth(bText) + 6;
                            doc.setFillColor(140, 145, 150);
                            const badgeX = 14 + (w / 2) - (bWidth / 2);
                            doc.roundedRect(badgeX, currentY - 4, bWidth, 5.5, 1, 1, 'F');
                            doc.setTextColor(255, 255, 255);
                            doc.text(bText, badgeX + 3, currentY);
                            
                            doc.setDrawColor(220, 220, 220);
                            doc.setLineWidth(0.5);
                            doc.rect(14, currentY + 4, w, h);
                            doc.addImage(beforeImg.data, 'JPEG', 14, currentY + 4, w, h);
                            currentAddedHeight = Math.max(currentAddedHeight, h);
                        }

                        if (afterImg) {
                            let w = maxImgWidth;
                            let h = (w * afterImg.height) / afterImg.width;
                            if (h > maxImgHeight) {
                                h = maxImgHeight;
                                w = (h * afterImg.width) / afterImg.height;
                            }
                            
                            if (currentY + h > 270) {
                                if (!beforeImg) {
                                    doc.addPage();
                                    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
                                    doc.rect(0, 0, pageWidth, 6, 'F');
                                    currentY = 20;
                                }
                            }
                            doc.setFontSize(8);
                            doc.setFont('helvetica', 'bold');
                            const aText = "AFTER";
                            const aWidth = doc.getTextWidth(aText) + 6;
                            doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
                            const badgeX = 105 + (w / 2) - (aWidth / 2);
                            doc.roundedRect(badgeX, currentY - 4, aWidth, 5.5, 1, 1, 'F');
                            doc.setTextColor(255, 255, 255);
                            doc.text(aText, badgeX + 3, currentY);
                            
                            doc.setDrawColor(220, 220, 220);
                            doc.setLineWidth(0.5);
                            doc.rect(105, currentY + 4, w, h);
                            doc.addImage(afterImg.data, 'JPEG', 105, currentY + 4, w, h);
                            currentAddedHeight = Math.max(currentAddedHeight, h);
                        }

                        currentY += currentAddedHeight + 16; 
                        
                        if (currentY > 250 && i < poisWithImages.length - 1) {
                            doc.addPage();
                            doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
                            doc.rect(0, 0, pageWidth, 6, 'F');
                            currentY = 20;
                        }
                    }
                }
            }

			// Add page numbers
			const pageCount = (doc as any).internal.getNumberOfPages();
			for (let i = 1; i <= pageCount; i++) {
				doc.setPage(i);
				doc.setFontSize(9);
				doc.setFont('helvetica', 'normal');
				doc.setTextColor(150);
				doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
			}

			doc.save(`${client}_Project_Summary_${new Date().toISOString().split('T')[0]}.pdf`);
		} catch (error) {
			console.error("Failed to generate project PDF", error);
		} finally {
			setGeneratingPdf(null);
		}
	};

	if (loading) return <Loading title='Loading tickets' />;
	if (!canView) return null;

	return (
		<section className='space-y-4'>
			<div className='flex flex-col sm:flex-row sm:items-center gap-3 justify-between bg-(--foreground) p-4 rounded-3xl'>
				<div className='flex items-center gap-3'>
					<div className='w-10 h-10 shrink-0 rounded-xl bg-(--accent)/10 text-(--accent) flex items-center justify-center'>
						<TicketIcon size={20} />
					</div>
					<div className='min-w-0'>
						<h2 className='font-semibold truncate'>Tickets</h2>
						<p className='text-xs text-(--text-muted) truncate'>Manage work points and visits</p>
					</div>
				</div>

				<div className="flex gap-2 flex-col sm:flex-row w-full sm:w-auto">
					{tickets.length > 0 && (
						<Button
							variant="secondary"
							onClick={generateProjectPDF}
							disabled={generatingPdf !== null}
							icon={generatingPdf === 'project' ? <Loader2 size={16} className="animate-spin" /> : <FileIcon size={16} />}
							className="w-full sm:w-auto justify-center"
						>
							{generatingPdf === 'project' ? 'Generating...' : 'Project Summary'}
						</Button>
					)}
					{isAllowed && (
						<Button
							onClick={() => {
								setSelectedTicket(null);
								setModalOpen(true);
							}}
							icon={<Plus size={16} />}
							className="w-full sm:w-auto justify-center"
						>
							New Ticket
						</Button>
					)}
				</div>
			</div>

			{tickets.length === 0 && <EmptyState title='No Tickets Found' description='Create a new ticket to track points of interest.' />}

			<div className='space-y-6'>
				{tickets.map((ticket) => (
					<Card key={ticket.id} className='overflow-hidden'>
						<div 
							className='p-4 border-b border-(--border)/10 flex flex-col sm:flex-row sm:items-center gap-3 justify-between bg-(--background) min-w-0 cursor-pointer hover:bg-(--foreground) transition-colors'
							onClick={() => setExpandedTickets((curr) => ({ ...curr, [ticket.id]: !curr[ticket.id] }))}
						>
							<div className='min-w-0 flex items-center gap-3'>
								<ChevronDown className={`shrink-0 text-(--text-muted) transition-transform ${expandedTickets[ticket.id] ? 'rotate-180' : ''}`} size={20} />
								<div className='min-w-0'>
									<h3 className='font-medium truncate'>{ticket.name || 'Ticket'}</h3>
									<div className='text-xs text-(--text-muted) flex items-center gap-2 mt-1 flex-wrap min-w-0'>
										<Clock size={12} className='shrink-0' />
										<span className='truncate min-w-0 flex-1'>{new Date(ticket.createdAt).toLocaleString()} &bull; Opened by {ticket.openedBy}</span>
									</div>
								</div>
							</div>
							<div className='flex flex-wrap items-center gap-3 sm:gap-4 shrink-0'>
								<div className='text-sm font-medium shrink-0'>
									{ticket.pois.filter((p) => p.state === 'finished').length} / {ticket.pois.length} Finished
								</div>
								{isAllowed && (
									<Button
										size='sm'
										variant='secondary'
										icon={<Plus size={16} />}
										onClick={(e) => {
											e.stopPropagation();
											setSelectedTicket(ticket);
											setModalOpen(true);
										}}>
										Add POI
									</Button>
								)}
								<Button
									size='sm'
									variant='secondary'
									disabled={generatingPdf === ticket.id}
									icon={generatingPdf === ticket.id ? <Loader2 size={16} className='animate-spin' /> : <FileIcon size={16} />}
									onClick={(e) => {
										e.stopPropagation();
										generatePDF(ticket);
									}}>
									{generatingPdf === ticket.id ? 'Generating...' : 'Summary'}
								</Button>
							</div>
						</div>

						{expandedTickets[ticket.id] && (
							<div className='divide-y divide-(--border)/10 min-w-0'>
								<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, ticket.id)}>
									<SortableContext items={ticket.pois.map((p) => p.id)} strategy={verticalListSortingStrategy}>
										{ticket.pois.map((poi) => (
											<SortablePOI key={poi.id} poi={poi} ticket={ticket} currentUsername={currentUsername} isAllowed={isAllowed} setPoiToComplete={setPoiToComplete} />
										))}
									</SortableContext>
								</DndContext>
								{ticket.pois.length === 0 && (
									<div className='p-4 text-sm text-(--text-muted) text-center'>No points of interest for this ticket.</div>
								)}
							</div>
						)}
					</Card>
				))}
			</div>

			<TicketModal
				open={modalOpen}
				client={client}
				users={users}
				existingTicket={selectedTicket}
				onClose={() => {
					setModalOpen(false);
					setSelectedTicket(null);
					load();
				}}
			/>

			{poiToComplete && (
				<CompleteTaskModal
					open={true}
					client={client}
					poiId={poiToComplete.poiId}
					requiresPicture={poiToComplete.requiresPicture}
					users={users}
					onClose={() => setPoiToComplete(null)}
					onComplete={(imagePath, completedBy, proofDescription) => markPOIDone(poiToComplete.ticketId, poiToComplete.poiId, imagePath, completedBy, proofDescription)}
				/>
			)}
		</section>
	);
}

function SortablePOI({ poi, ticket, currentUsername, isAllowed, setPoiToComplete }: { poi: POI; ticket: Ticket; currentUsername: string; isAllowed: boolean; setPoiToComplete: any }) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: poi.id });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		zIndex: isDragging ? 10 : 1,
		opacity: isDragging ? 0.5 : 1,
	};

	return (
		<div ref={setNodeRef} style={style} className='p-4 flex flex-col lg:flex-row gap-4 lg:items-center justify-between min-w-0 bg-(--background) relative'>
			<div className='flex items-start gap-3 flex-1 min-w-0'>
				{isAllowed && (
					<div {...attributes} {...listeners} className='mt-1 cursor-grab active:cursor-grabbing text-(--border)/40 hover:text-(--text-muted) transition-colors shrink-0 touch-none'>
						<GripVertical size={20} />
					</div>
				)}
				<button
					disabled={poi.state === 'finished' || (poi.technician !== currentUsername && !isAllowed)}
					onClick={() => setPoiToComplete({ ticketId: ticket.id, poiId: poi.id, requiresPicture: poi.requiresPicture })}
					className={`mt-1 shrink-0 ${poi.state === 'finished' ? 'text-green-500' : 'text-(--text-muted) hover:text-(--accent)'} transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}>
					{poi.state === 'finished' ? <CheckCircle2 size={20} /> : <Circle size={20} />}
				</button>
				<div className='flex-1 min-w-0'>
					<p className={`text-sm break-words whitespace-normal ${poi.state === 'finished' ? 'line-through text-(--text-muted)' : ''}`}>
						{poi.description}
					</p>
					<div className='flex flex-wrap items-center gap-2 mt-2 text-xs min-w-0'>
						{poi.state === 'finished' && poi.completedBy ? (
							<span className='px-2 py-0.5 rounded-full bg-(--background) border border-green-500/20 text-green-500 truncate max-w-full'>
								Completed by: {poi.completedBy}
							</span>
						) : (
							<span className='px-2 py-0.5 rounded-full bg-(--background) border border-(--border)/10 text-(--text-muted) truncate max-w-full'>
								{poi.technician || 'Unassigned'}
							</span>
						)}
						<span className='px-2 py-0.5 rounded-full capitalize shrink-0 bg-zinc-500/10 text-zinc-500 font-mono text-[10px]'>
							#{poi.importance || (ticket.pois.findIndex((p) => p.id === poi.id) + 1)}
						</span>
					</div>
				</div>
			</div>

			<div className='flex gap-3 shrink-0 flex-col sm:flex-row w-full lg:w-auto min-w-0'>
				{poi.imagePath && (
					<div className='w-full sm:w-48 min-w-0'>
						<File file={{ name: poi.imagePath.split('/').pop() || 'POI.jpg', path: poi.imagePath, type: 'file' }} image />
					</div>
				)}
				{poi.finishedImagePath && (
					<div className='relative w-full sm:w-48 overflow-hidden min-w-0 mt-3 sm:mt-0'>
						<File file={{ name: poi.finishedImagePath.split(/[/\\]/).pop() || 'Proof.jpg', path: poi.finishedImagePath, type: 'file' }} image />
						<div className='absolute top-2 right-2 bg-green-500/90 backdrop-blur-md text-white px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-sm pointer-events-none'>
							<CheckCircle2 size={12} />
							Proof
						</div>
					</div>
				)}

				{poi.proofDescription && (
					<div className='bg-zinc-50 dark:bg-zinc-800/50 p-3 mt-3 sm:mt-0 rounded-lg border border-zinc-200 dark:border-zinc-800/50 text-sm italic text-zinc-600 dark:text-zinc-400'>
						"{poi.proofDescription}"
					</div>
				)}
			</div>
		</div>
	);
}

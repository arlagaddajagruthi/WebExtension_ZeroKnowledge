import { describe, it, expect } from 'vitest';
import {
    analyzePasswordStrength,
    findReusedPasswords,
    findWeakPasswords,
    getBreachSummary,
    type CredentialBreachStatus,
} from './breach-monitoring';
import type { Credential } from '../utils/types';

describe('Breach Monitoring Service', () => {
    describe('Password Strength Analysis', () => {
        it('should identify weak passwords', () => {
            const weak = ['pass', '123456', 'abc'];
            weak.forEach(pwd => {
                expect(analyzePasswordStrength(pwd)).toBe('weak');
            });
        });

        it('should identify fair passwords', () => {
            const fair = ['Pass1234', 'Password1', 'Pwd123'];
            fair.forEach(pwd => {
                expect(analyzePasswordStrength(pwd)).toBe('fair');
            });
        });

        it('should identify good passwords', () => {
            const good = ['Password@1', 'SecurePass123', 'MyPass!123'];
            good.forEach(pwd => {
                expect(analyzePasswordStrength(pwd)).toBe('good');
            });
        });

        it('should identify strong passwords', () => {
            const strong = [
                'VerySecureP@ssw0rd!',
                'C0mpl3x!P@ssw0rd#2024',
                'MySuper$ecurePassw0rd!',
            ];
            strong.forEach(pwd => {
                expect(analyzePasswordStrength(pwd)).toBe('strong');
            });
        });

        it('should consider length in strength', () => {
            const short = 'Pwd123!';
            const long = 'VeryLongPasswordWith123!@#';
            
            const shortStrength = analyzePasswordStrength(short);
            const longStrength = analyzePasswordStrength(long);
            
            expect(longStrength).not.toBe('weak');
        });

        it('should consider character diversity', () => {
            const lowercase = 'passwordpasswordpassword';
            const mixed = 'PasswordMixedCase123!@#';
            
            const lowerStrength = analyzePasswordStrength(lowercase);
            const mixedStrength = analyzePasswordStrength(mixed);
            
            expect(mixedStrength).not.toBe(lowerStrength);
        });
    });

    describe('Reused Password Detection', () => {
        it('should identify reused passwords', () => {
            const credentials: Credential[] = [
                {
                    id: '1',
                    name: 'Gmail',
                    url: 'https://gmail.com',
                    username: 'user@gmail.com',
                    password: 'SharedPassword123!',
                    lastUpdated: Date.now(),
                    version: 1,
                },
                {
                    id: '2',
                    name: 'Outlook',
                    url: 'https://outlook.com',
                    username: 'user@outlook.com',
                    password: 'SharedPassword123!',
                    lastUpdated: Date.now(),
                    version: 1,
                },
                {
                    id: '3',
                    name: 'GitHub',
                    url: 'https://github.com',
                    username: 'user',
                    password: 'UniquePassword456!',
                    lastUpdated: Date.now(),
                    version: 1,
                },
            ];

            const reused = findReusedPasswords(credentials);
            expect(reused.size).toBe(1);
            expect(reused.get('SharedPassword123!')?.length).toBe(2);
        });

        it('should not report unique passwords as reused', () => {
            const credentials: Credential[] = [
                {
                    id: '1',
                    name: 'Gmail',
                    url: 'https://gmail.com',
                    username: 'user@gmail.com',
                    password: 'UniquePassword1!',
                    lastUpdated: Date.now(),
                    version: 1,
                },
                {
                    id: '2',
                    name: 'GitHub',
                    url: 'https://github.com',
                    username: 'user',
                    password: 'UniquePassword2!',
                    lastUpdated: Date.now(),
                    version: 1,
                },
            ];

            const reused = findReusedPasswords(credentials);
            expect(reused.size).toBe(0);
        });

        it('should handle empty credentials', () => {
            const reused = findReusedPasswords([]);
            expect(reused.size).toBe(0);
        });
    });

    describe('Weak Password Detection', () => {
        it('should identify weak passwords', () => {
            const credentials: Credential[] = [
                {
                    id: '1',
                    name: 'Site1',
                    url: 'https://site1.com',
                    username: 'user',
                    password: '123456',
                    lastUpdated: Date.now(),
                    version: 1,
                },
                {
                    id: '2',
                    name: 'Site2',
                    url: 'https://site2.com',
                    username: 'user',
                    password: 'StrongPassword123!@#',
                    lastUpdated: Date.now(),
                    version: 1,
                },
            ];

            const weak = findWeakPasswords(credentials);
            expect(weak.length).toBeGreaterThan(0);
            expect(weak[0].password).toBe('123456');
        });

        it('should not flag strong passwords as weak', () => {
            const credentials: Credential[] = [
                {
                    id: '1',
                    name: 'Site1',
                    url: 'https://site1.com',
                    username: 'user',
                    password: 'SuperSecurePassword123!@#',
                    lastUpdated: Date.now(),
                    version: 1,
                },
            ];

            const weak = findWeakPasswords(credentials);
            expect(weak.length).toBe(0);
        });
    });

    describe('Breach Summary', () => {
        it('should calculate correct summary statistics', () => {
            const statuses: CredentialBreachStatus[] = [
                {
                    id: '1',
                    name: 'Site1',
                    url: 'https://site1.com',
                    username: 'user1',
                    password: 'pass1',
                    lastUpdated: Date.now(),
                    version: 1,
                    breachStatus: {
                        isCompromised: true,
                        breachCount: 5,
                        message: 'Compromised',
                    },
                },
                {
                    id: '2',
                    name: 'Site2',
                    url: 'https://site2.com',
                    username: 'user2',
                    password: 'pass2',
                    lastUpdated: Date.now(),
                    version: 1,
                    breachStatus: {
                        isCompromised: false,
                        message: 'Safe',
                    },
                },
                {
                    id: '3',
                    name: 'Site3',
                    url: 'https://site3.com',
                    username: 'user3',
                    password: 'pass3',
                    lastUpdated: Date.now(),
                    version: 1,
                    // No breach status (not checked)
                },
            ];

            const summary = getBreachSummary(statuses);

            expect(summary.total).toBe(3);
            expect(summary.compromised).toBe(1);
            expect(summary.uncompromised).toBe(1);
            expect(summary.unchecked).toBe(1);
            expect(summary.compromisedPercentage).toBeCloseTo(33.33, 1);
        });

        it('should handle empty credentials', () => {
            const summary = getBreachSummary([]);

            expect(summary.total).toBe(0);
            expect(summary.compromised).toBe(0);
            expect(summary.compromisedPercentage).toBe(0);
        });
    });
});

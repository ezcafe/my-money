/**
 * Calculator Component Tests
 * TDD: Write tests first, then implement
 */

import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {Calculator} from '../../src/components/Calculator';
import {ThemeProvider} from '../../src/theme/ThemeProvider';

describe('Calculator', () => {
  const renderCalculator = () => {
    return render(
      <ThemeProvider>
        <Calculator />
      </ThemeProvider>,
    );
  };

  it('should render calculator with number pad', () => {
    renderCalculator();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
  });

  it('should display numbers when clicked', () => {
    renderCalculator();
    fireEvent.click(screen.getByText('5'));
    expect(screen.getByDisplayValue('5')).toBeInTheDocument();
  });

  it('should perform addition', () => {
    renderCalculator();
    fireEvent.click(screen.getByText('5'));
    fireEvent.click(screen.getByText('+'));
    fireEvent.click(screen.getByText('3'));
    fireEvent.click(screen.getByText('='));
    expect(screen.getByDisplayValue('8')).toBeInTheDocument();
  });

  it('should perform subtraction', () => {
    renderCalculator();
    fireEvent.click(screen.getByText('10'));
    fireEvent.click(screen.getByText('-'));
    fireEvent.click(screen.getByText('3'));
    fireEvent.click(screen.getByText('='));
    expect(screen.getByDisplayValue('7')).toBeInTheDocument();
  });

  it('should handle negative results', () => {
    renderCalculator();
    fireEvent.click(screen.getByText('5'));
    fireEvent.click(screen.getByText('-'));
    fireEvent.click(screen.getByText('10'));
    fireEvent.click(screen.getByText('='));
    expect(screen.getByDisplayValue('-5')).toBeInTheDocument();
  });

  it('should clear display when Clear is clicked', () => {
    renderCalculator();
    fireEvent.click(screen.getByText('5'));
    fireEvent.click(screen.getByText('Clear'));
    expect(screen.getByDisplayValue('0')).toBeInTheDocument();
  });

  it('should add 000 button for thousands', () => {
    renderCalculator();
    expect(screen.getByText('000')).toBeInTheDocument();
  });

  it('should have Add button', () => {
    renderCalculator();
    expect(screen.getByText('Add')).toBeInTheDocument();
  });

  it('should have Settings button', () => {
    renderCalculator();
    expect(screen.getByLabelText('Settings')).toBeInTheDocument();
  });
});








